/**
 * =====================================================================================
 * Admin Tier Management API - CRUD Operations
 * =====================================================================================
 * 
 * ENDPOINTS:
 * - GET    /api/admin/tiers          - List all tiers (with usage stats)
 * - POST   /api/admin/tiers          - Create new tier
 * - PATCH  /api/admin/tiers/[id]     - Update tier
 * - DELETE /api/admin/tiers/[id]     - Delete tier (only if unused)
 * - PATCH  /api/admin/tiers/[id]/toggle - Activate/deactivate tier
 * 
 * SECURITY:
 * - Admin-only access (RBAC enforced)
 * - Audit logging for all changes
 * - Prevents deletion of tiers with active leagues
 * - Validates all tier configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { z } from 'zod';

// =====================================================================================
// VALIDATION SCHEMAS
// =====================================================================================

const nonNegativeNullable = z.number().min(0).nullable().optional();

const CreateTierSchema = z.object({
  name: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/, 'Name must be lowercase alphanumeric with underscores'),
  display_name: z.string().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  max_days: z.number().int().min(1).max(365),
  max_participants: z.number().int().min(1).max(10000),
  pricing_type: z.enum(['fixed', 'dynamic']),
  
  // Pricing fields (conditional based on pricing_type)
  fixed_price: nonNegativeNullable,
  base_fee: nonNegativeNullable,
  per_day_rate: nonNegativeNullable,
  per_participant_rate: nonNegativeNullable,
  gst_percentage: z.number().min(0).max(100).default(18),
  
  display_order: z.number().int().min(0).default(0),
  is_featured: z.boolean().default(false),
  features: z.array(z.string()).default([])
});

const UpdateTierSchema = CreateTierSchema.partial().extend({
  is_active: z.boolean().optional(),
  pricing_type: z.enum(['fixed', 'dynamic']).optional(),
});

// =====================================================================================
// HELPER FUNCTIONS
// =====================================================================================

/**
 * Check if user is admin
 */
async function checkAdminAccess(): Promise<{ success: boolean; user_id?: string; error?: string }> {
  // Try NextAuth session first
  const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
  console.debug('admin/tiers checkAdminAccess - session present:', !!session, 'user:', session?.user ? { id: (session.user as any).id, email: (session.user as any).email, platform_role: (session.user as any).platform_role } : null);
  const sessionUserId = (session?.user as any)?.id || (session?.user as any)?.sub;
  const sessionRole = (session?.user as any)?.platform_role || (session?.user as any)?.role;

  const supabase = getSupabaseServiceRole();

  // If session explicitly says admin, allow without DB round-trip
  if (sessionUserId && sessionRole === 'admin') {
    return { success: true, user_id: sessionUserId };
  }

  let userId = sessionUserId;

  // If no userId from session, cannot proceed
  if (!userId) {
    console.warn('admin/tiers checkAdminAccess - no userId from session');
    return { success: false, error: 'Unauthorized' };
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('platform_role')
    .eq('user_id', userId)
    .single();
  
  console.debug('admin/tiers checkAdminAccess - users.platform_role lookup', { userId, userData: userData ?? null, userError });
  if (userError || userData?.platform_role !== 'admin') {
    console.warn('admin/tiers checkAdminAccess - admin check failed', { userId, userData, userError });
    return { success: false, error: 'Admin access required' };
  }
  
  return { success: true, user_id: userId };
}



// =====================================================================================
// GET /api/admin/tiers - List all tiers
// =====================================================================================

export async function GET(_request: NextRequest) {
  try {
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }

    const supabase = getSupabaseServiceRole();
    const { data: tiers, error } = await supabase
      .from('league_tiers')
      .select(`
        id,
        name,
        display_name,
        description,
        max_days,
        max_participants,
        pricing_id,
        is_active,
        display_order,
        is_featured,
        features,
        created_at,
        updated_at
      `)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch tiers:', error);
      return NextResponse.json({ error: 'Failed to fetch tiers' }, { status: 500 });
    }

    // Fetch pricing for each tier separately
    const tiersWithPricing = await Promise.all(
      tiers.map(async (tier: any) => {
        let pricing = null;
        if (tier.pricing_id) {
          const { data: pricingData } = await supabase
            .from('pricing')
            .select('*')
            .eq('id', tier.pricing_id)
            .single();
          pricing = pricingData;
        }
        return {
          ...tier,
          pricing,
          // Flatten pricing fields to tier level for backward compatibility
          pricing_type: pricing?.pricing_type || null,
          fixed_price: pricing?.fixed_price || null,
          base_fee: pricing?.base_fee || null,
          per_day_rate: pricing?.per_day_rate || null,
          per_participant_rate: pricing?.per_participant_rate || null,
          gst_percentage: pricing?.gst_percentage || null,
        };
      })
    );

    return NextResponse.json({ tiers: tiersWithPricing });
  } catch (error) {
    console.error('GET tiers error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================================================
// POST /api/admin/tiers - Create new tier
// =====================================================================================

export async function POST(request: NextRequest) {
  try {
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    const body = await request.json();
    const validationResult = CreateTierSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    
    const data = validationResult.data;
    const supabase = getSupabaseServiceRole();
    
    const resolvedFixedPrice = data.pricing_type === 'fixed' ? data.fixed_price ?? null : null;
    const resolvedBaseFee = data.base_fee ?? 0;
    const resolvedPerDayRate = data.per_day_rate ?? 0;
    const resolvedPerParticipantRate = data.per_participant_rate ?? 0;

    // Validate pricing configuration
    if (data.pricing_type === 'fixed') {
      if (resolvedFixedPrice === null || resolvedFixedPrice <= 0) {
        return NextResponse.json(
          { error: 'fixed_price must be provided and greater than 0 for fixed pricing' },
          { status: 400 }
        );
      }
    }

    if (data.pricing_type === 'dynamic') {
      if (resolvedBaseFee <= 0 && resolvedPerDayRate <= 0 && resolvedPerParticipantRate <= 0) {
        return NextResponse.json(
          { error: 'At least one pricing component (base_fee, per_day_rate, or per_participant_rate) must be greater than 0 for dynamic pricing' },
          { status: 400 }
        );
      }
    }
    
    // Create pricing entry first
    const { data: pricingData, error: pricingError } = await supabase
      .from('pricing')
      .insert({
        tier_name: data.name,
        pricing_type: data.pricing_type,
        fixed_price: resolvedFixedPrice,
        base_fee: resolvedBaseFee,
        per_day_rate: resolvedPerDayRate,
        per_participant_rate: resolvedPerParticipantRate,
        gst_percentage: data.gst_percentage,
        is_active: true,
        created_by: adminCheck.user_id
      })
      .select()
      .single();
    
    if (pricingError || !pricingData) {
      console.error('Failed to create pricing:', pricingError);
      console.debug('create pricing payload:', { data: { tier_name: data.name, pricing_type: data.pricing_type, resolvedFixedPrice, resolvedBaseFee, resolvedPerDayRate, resolvedPerParticipantRate, gst_percentage: data.gst_percentage }, admin: adminCheck.user_id });
      return NextResponse.json({ error: 'Failed to create pricing configuration' }, { status: 500 });
    }
    
    // Create tier entry
    const { data: tierData, error: tierError } = await supabase
      .from('league_tiers')
      .insert({
        name: data.name,
        display_name: data.display_name,
        description: data.description,
        max_days: data.max_days,
        max_participants: data.max_participants,
        pricing_id: pricingData.id,
        display_order: data.display_order,
        is_featured: data.is_featured,
        features: data.features ?? [],
        is_active: true,
        created_by: adminCheck.user_id
      })
      .select()
      .single();
    
    if (tierError || !tierData) {
      // Rollback pricing creation
      await supabase.from('pricing').delete().eq('id', pricingData.id);
      console.error('Failed to create tier:', tierError);
      console.debug('create tier payload:', { tier: { name: data.name, display_name: data.display_name, max_days: data.max_days, max_participants: data.max_participants }, admin: adminCheck.user_id });
      return NextResponse.json({ error: 'Failed to create tier' }, { status: 500 });
    }
    
    return NextResponse.json({ tier: tierData, pricing: pricingData }, { status: 201 });
    
  } catch (error) {
    console.error('POST tier error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
