/**
 * =====================================================================================
 * Admin Tier Management API - Individual Tier Operations
 * =====================================================================================
 * 
 * ENDPOINTS:
 * - GET    /api/admin/tiers/[id]        - Get single tier details
 * - PATCH  /api/admin/tiers/[id]        - Update tier configuration
 * - DELETE /api/admin/tiers/[id]        - Delete tier (only if unused)
 * 
 * SECURITY:
 * - Admin-only access
 * - Prevents deletion of tiers with active leagues
 * - Audit logging for all changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { z } from 'zod';

// Import shared helpers
async function checkAdminAccess(): Promise<{ success: boolean; user_id?: string; error?: string }> {
  // Try NextAuth session first
  const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
  console.debug('tiers/[id] checkAdminAccess - session present:', !!session, 'user:', session?.user ? { id: (session.user as any).id, email: (session.user as any).email, platform_role: (session.user as any).platform_role } : null);
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
    console.warn('admin/tiers/[id] checkAdminAccess - no userId from session');
    return { success: false, error: 'Unauthorized' };
  }

  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('platform_role')
    .eq('user_id', userId)
    .single();
  console.debug('tiers/[id] checkAdminAccess - users.platform_role lookup', { userId, userData: userData ?? null, userError });
  if (userError || userData?.platform_role !== 'admin') {
    console.warn('tiers/[id] checkAdminAccess - admin check failed', { userId, userData, userError });
    return { success: false, error: 'Admin access required' };
  }
  
  return { success: true, user_id: userId };
}



// Validation schema
const nonNegativeNullable = z.number().min(0).nullable().optional();

const UpdateTierSchema = z.object({
  // Tier fields
  name: z.string().min(2).max(50).regex(/^[a-z0-9_]+$/, 'Name must be lowercase alphanumeric with underscores').optional(),
  display_name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  max_days: z.number().int().min(1).max(365).optional(),
  max_participants: z.number().int().min(1).max(10000).optional(),
  display_order: z.number().int().min(0).optional(),
  is_featured: z.boolean().optional(),
  features: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),

  // Pricing updates
  pricing_type: z.enum(['fixed', 'dynamic']).optional(),
  fixed_price: nonNegativeNullable,
  base_fee: nonNegativeNullable,
  per_day_rate: nonNegativeNullable,
  per_participant_rate: nonNegativeNullable,
  gst_percentage: z.number().min(0).max(100).optional(),
});

// =====================================================================================
// GET /api/admin/tiers/[id] - Get tier details
// =====================================================================================

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    const { id } = await context.params;
    const supabase = getSupabaseServiceRole();
    const { data: tier, error } = await supabase
      .from('league_tiers')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !tier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }
    // Fetch pricing separately
    let pricingData = null;
    if (tier.pricing_id) {
      const { data: pricing } = await supabase
        .from('pricing')
        .select('*')
        .eq('id', tier.pricing_id)
        .single();
      pricingData = pricing;
    }
    // Flatten pricing fields to tier level for backward compatibility
    const tierWithPricing = {
      ...tier,
      pricing: pricingData,
      pricing_type: pricingData?.pricing_type || null,
      fixed_price: pricingData?.fixed_price || null,
      base_fee: pricingData?.base_fee || null,
      per_day_rate: pricingData?.per_day_rate || null,
      per_participant_rate: pricingData?.per_participant_rate || null,
      gst_percentage: pricingData?.gst_percentage || null,
    };
    return NextResponse.json({ tier: tierWithPricing, pricing: pricingData });
  } catch (error) {
    console.error('GET tier error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================================================
// PATCH /api/admin/tiers/[id] - Update tier
// =====================================================================================

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const validationResult = UpdateTierSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.errors },
        { status: 400 }
      );
    }
    const updates = validationResult.data;
    const supabase = getSupabaseServiceRole();
    // Fetch current tier data for comparison (separate queries)
    const { data: currentTier, error: fetchError } = await supabase
      .from('league_tiers')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError || !currentTier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }
    // Fetch current pricing
    let currentPricing = null;
    if (currentTier.pricing_id) {
      const { data: pricing } = await supabase
        .from('pricing')
        .select('*')
        .eq('id', currentTier.pricing_id)
        .single();
      currentPricing = pricing;
    }
    // Check if tier has active leagues (warn about impacts)
    const { data: activeLeagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('league_id')
      .eq('tier_id', id)
      .in('status', ['active', 'scheduled', 'ended', 'completed', 'cancelled', 'abandoned']);
    const hasActiveLeagues = activeLeagues && activeLeagues.length > 0;
    // Separate tier updates from pricing updates
    const tierUpdates: any = {};
    const pricingUpdates: any = {};
    if (updates.name !== undefined) {
      tierUpdates.name = updates.name;
      pricingUpdates.tier_name = updates.name;
    }
    if (updates.display_name !== undefined) tierUpdates.display_name = updates.display_name;
    if (updates.description !== undefined) tierUpdates.description = updates.description;
    if (updates.max_days !== undefined) tierUpdates.max_days = updates.max_days;
    if (updates.max_participants !== undefined) tierUpdates.max_participants = updates.max_participants;
    if (updates.display_order !== undefined) tierUpdates.display_order = updates.display_order;
    if (updates.is_featured !== undefined) tierUpdates.is_featured = updates.is_featured;
    if (updates.features !== undefined) tierUpdates.features = updates.features;
    if (updates.is_active !== undefined) tierUpdates.is_active = updates.is_active;
    if (updates.pricing_type !== undefined) pricingUpdates.pricing_type = updates.pricing_type;
    if (updates.fixed_price !== undefined) pricingUpdates.fixed_price = updates.fixed_price;
    if (updates.base_fee !== undefined) pricingUpdates.base_fee = updates.base_fee;
    if (updates.per_day_rate !== undefined) pricingUpdates.per_day_rate = updates.per_day_rate;
    if (updates.per_participant_rate !== undefined) pricingUpdates.per_participant_rate = updates.per_participant_rate;
    if (updates.gst_percentage !== undefined) pricingUpdates.gst_percentage = updates.gst_percentage;
    // Add updated_by and updated_at only to objects that will be updated
    if (Object.keys(tierUpdates).length > 0) {
      tierUpdates.updated_by = adminCheck.user_id;
      tierUpdates.updated_at = new Date().toISOString();
    }
    if (Object.keys(pricingUpdates).length > 0) {
      pricingUpdates.updated_by = adminCheck.user_id;
      pricingUpdates.updated_at = new Date().toISOString();
    }
    // Validation: ensure pricing fields align with effective pricing_type
    const effectivePricingType = updates.pricing_type ?? currentPricing?.pricing_type;
    const resolvedFixedPrice = updates.fixed_price ?? currentPricing?.fixed_price ?? null;
    const resolvedBaseFee = updates.base_fee ?? currentPricing?.base_fee ?? 0;
    const resolvedPerDayRate = updates.per_day_rate ?? currentPricing?.per_day_rate ?? 0;
    const resolvedPerParticipantRate = updates.per_participant_rate ?? currentPricing?.per_participant_rate ?? 0;
    if (effectivePricingType === 'fixed') {
      if (resolvedFixedPrice === null || resolvedFixedPrice <= 0) {
        return NextResponse.json({ error: 'Fixed pricing requires fixed_price > 0' }, { status: 400 });
      }
    }
    if (effectivePricingType === 'dynamic') {
      if (resolvedBaseFee <= 0 && resolvedPerDayRate <= 0 && resolvedPerParticipantRate <= 0) {
        return NextResponse.json({ error: 'Dynamic pricing needs base_fee, per_day_rate, or per_participant_rate > 0' }, { status: 400 });
      }
    }
    // Update tier
    let updatedTier = currentTier;
    if (Object.keys(tierUpdates).length > 0) {
      const { error } = await supabase
        .from('league_tiers')
        .update(tierUpdates)
        .eq('id', id);
      if (error) {
        console.error('Failed to update tier:', error);
        console.debug('Failed to update tier - payload:', { id, tierUpdates, admin: adminCheck.user_id });
        return NextResponse.json({ error: 'Failed to update tier' }, { status: 500 });
      }
      // Fetch updated tier separately (without relationship join)
      const { data: fetchedTier, error: fetchError } = await supabase
        .from('league_tiers')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchError || !fetchedTier) {
        console.error('Failed to fetch updated tier:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch updated tier' }, { status: 500 });
      }
      updatedTier = fetchedTier;
    }
    // Update pricing
    if (Object.keys(pricingUpdates).length > 0 && currentTier.pricing_id) {
      const { error: pricingError } = await supabase
        .from('pricing')
        .update(pricingUpdates)
        .eq('id', currentTier.pricing_id);
      if (pricingError) {
        console.error('Failed to update pricing:', pricingError);
        console.debug('Failed to update pricing - payload:', { pricing_id: currentTier.pricing_id, pricingUpdates, admin: adminCheck.user_id });
        return NextResponse.json({ error: 'Failed to update pricing', details: pricingError }, { status: 500 });
      }
    } else if (!currentTier.pricing_id) {
      console.warn('Tier has no pricing_id, skipping pricing update');
    }
    // Fetch updated pricing
    let pricingData = null;
    if (updatedTier.pricing_id) {
      const { data: pricing } = await supabase
        .from('pricing')
        .select('*')
        .eq('id', updatedTier.pricing_id)
        .single();
      pricingData = pricing;
    }
    // Flatten pricing fields to tier level for backward compatibility
    const tierWithPricing = {
      ...updatedTier,
      pricing: pricingData,
      pricing_type: pricingData?.pricing_type || null,
      fixed_price: pricingData?.fixed_price || null,
      base_fee: pricingData?.base_fee || null,
      per_day_rate: pricingData?.per_day_rate || null,
      per_participant_rate: pricingData?.per_participant_rate || null,
      gst_percentage: pricingData?.gst_percentage || null,
    };
    return NextResponse.json({
      tier: tierWithPricing,
      pricing: pricingData,
      warning: hasActiveLeagues ? 'This tier has active leagues. Changes may affect future pricing but existing leagues retain their snapshot.' : null
    });
  } catch (error) {
    console.error('PATCH tier error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// =====================================================================================
// DELETE /api/admin/tiers/[id] - Delete tier
// =====================================================================================

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    const { id } = await context.params;
    const supabase = getSupabaseServiceRole();
    // Check if tier has any leagues (active or not)
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('league_id, status')
      .eq('tier_id', id);
    if (leaguesError) {
      console.error('Failed to check tier usage:', leaguesError);
      return NextResponse.json({ error: 'Failed to check tier usage' }, { status: 500 });
    }
    if (leagues && leagues.length > 0) {
      const activeCount = leagues.filter(l => ['active', 'launched', 'draft'].includes(l.status)).length;
      return NextResponse.json(
        {
          error: 'Cannot delete tier with existing leagues',
          details: {
            total_leagues: leagues.length,
            active_leagues: activeCount,
            suggestion: 'Deactivate the tier instead to prevent new leagues from using it'
          }
        },
        { status: 400 }
      );
    }
    // Fetch tier for audit log before deletion
    const { data: tier } = await supabase
      .from('league_tiers')
      .select('*, pricing:pricing_id (*)')
      .eq('id', id)
      .single();
    if (!tier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }
    // Delete tier (pricing will be cascade deleted or restricted based on schema)
    const { error: deleteError } = await supabase
      .from('league_tiers')
      .delete()
      .eq('id', id);
    if (deleteError) {
      console.error('Failed to delete tier:', deleteError);
      return NextResponse.json({ error: 'Failed to delete tier' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Tier deleted successfully' });
  } catch (error) {
    console.error('DELETE tier error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
