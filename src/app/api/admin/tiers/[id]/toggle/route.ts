/**
 * =====================================================================================
 * Admin Tier Management API - Toggle Activation
 * =====================================================================================
 * 
 * ENDPOINT: PATCH /api/admin/tiers/[id]/toggle
 * 
 * PURPOSE: Activate or deactivate a tier
 * - Deactivated tiers are hidden from users
 * - Existing leagues using the tier are unaffected
 * - Safer than deletion (reversible)
 * 
 * SECURITY:
 * - Admin-only access
 * - Audit logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

async function checkAdminAccess(): Promise<{ success: boolean; user_id?: string; error?: string }> {
  const supabase = getSupabaseServiceRole();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { success: false, error: 'Unauthorized' };
  }
  
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('platform_role')
    .eq('user_id', user.id)
    .single();
  
  if (userError || userData?.platform_role !== 'admin') {
    return { success: false, error: 'Admin access required' };
  }
  
  return { success: true, user_id: user.id };
}



export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminCheck = await checkAdminAccess();
    if (!adminCheck.success) {
      return NextResponse.json({ error: adminCheck.error }, { status: 403 });
    }
    
    const supabase = getSupabaseServiceRole();
    
    // Fetch current tier
    const { data: currentTier, error: fetchError } = await supabase
      .from('league_tiers')
      .select('id, name, is_active')
      .eq('id', params.id)
      .single();
    
    if (fetchError || !currentTier) {
      return NextResponse.json({ error: 'Tier not found' }, { status: 404 });
    }
    
    // Toggle activation
    const newStatus = !currentTier.is_active;
    
    const { data: updatedTier, error: updateError } = await supabase
      .from('league_tiers')
      .update({
        is_active: newStatus,
        updated_by: adminCheck.user_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single();
    
    if (updateError || !updatedTier) {
      console.error('Failed to toggle tier:', updateError);
      return NextResponse.json({ error: 'Failed to toggle tier activation' }, { status: 500 });
    }
    
    return NextResponse.json({
      tier: updatedTier,
      message: `Tier ${newStatus ? 'activated' : 'deactivated'} successfully`
    });
    
  } catch (error) {
    console.error('PATCH tier toggle error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
