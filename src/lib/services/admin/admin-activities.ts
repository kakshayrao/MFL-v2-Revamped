/**
 * Admin Activities Service
 * Handles all activity CRUD operations for the admin panel
 */

import { getSupabaseServiceRole } from '@/lib/supabase/client';
import type {
  AdminActivity,
  AdminActivityCreateInput,
  AdminActivityUpdateInput,
  AdminActivityFilters,
} from '@/types/admin';

/**
 * Get all activities with optional filters
 */
export async function getAllActivities(filters?: AdminActivityFilters): Promise<AdminActivity[]> {
  try {
    const supabase = getSupabaseServiceRole();
    let query = supabase
      .from('activities')
      .select(`
        *,
        activity_categories(category_id, category_name, display_name, description, display_order)
      `)
      .order('created_date', { ascending: false });

    // Apply search filter
    if (filters?.search) {
      query = query.or(
        `activity_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    // Apply category filter
    if (filters?.category_id) {
      query = query.eq('category_id', filters.category_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching activities:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      ...row,
      category: row.activity_categories || null,
    })) as AdminActivity[];
  } catch (err) {
    console.error('Error in getAllActivities:', err);
    return [];
  }
}

/**
 * Get a single activity by ID
 */
export async function getActivityById(activityId: string): Promise<AdminActivity | null> {
  try {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from('activities')
      .select(`*, activity_categories(category_id, category_name, display_name, description, display_order)`) 
      .eq('activity_id', activityId)
      .single();

    if (error) {
      console.error('Error fetching activity:', error);
      return null;
    }

    return data
      ? ({
          ...data,
          category: (data as any).activity_categories || null,
        } as AdminActivity)
      : null;
  } catch (err) {
    console.error('Error in getActivityById:', err);
    return null;
  }
}

/**
 * Create a new activity
 * @param accessToken - Supabase access token for admin auth (required for RLS)
 */
export async function createActivity(
  input: AdminActivityCreateInput,
  accessToken?: string,
  createdBy?: string
): Promise<AdminActivity | null> {
  try {
    const supabase = getSupabaseServiceRole();
    
    // Verify admin access if token provided
    if (accessToken) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        console.error('Unauthorized: Invalid authentication');
        return null;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('platform_role')
        .eq('user_id', user.id)
        .single();

      if (userError || userData?.platform_role !== 'admin') {
        console.error('Forbidden: Admin access required');
        return null;
      }
      
      if (!createdBy) {
        createdBy = user.id;
      }
    }
    const { data, error } = await supabase
      .from('activities')
      .insert({
        activity_name: input.activity_name,
        description: input.description || null,
        category_id: input.category_id || null,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating activity:', error);
      return null;
    }

    return data as AdminActivity;
  } catch (err) {
    console.error('Error in createActivity:', err);
    return null;
  }
}

/**
 * Update an existing activity
 * @param accessToken - Supabase access token for admin auth (required for RLS)
 */
export async function updateActivity(
  activityId: string,
  input: AdminActivityUpdateInput,
  accessToken?: string,
  modifiedBy?: string
): Promise<AdminActivity | null> {
  try {
    const supabase = getSupabaseServiceRole();
    
    // Verify admin access if token provided
    if (accessToken) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        console.error('Unauthorized: Invalid authentication');
        return null;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('platform_role')
        .eq('user_id', user.id)
        .single();

      if (userError || userData?.platform_role !== 'admin') {
        console.error('Forbidden: Admin access required');
        return null;
      }
      
      if (!modifiedBy) {
        modifiedBy = user.id;
      }
    }
    const { data, error } = await supabase
      .from('activities')
      .update({
        ...input,
        category_id: input.category_id ?? null,
        modified_by: modifiedBy || null,
        modified_date: new Date().toISOString(),
      })
      .eq('activity_id', activityId)
      .select()
      .single();

    if (error) {
      console.error('Error updating activity:', error);
      return null;
    }

    return data as AdminActivity;
  } catch (err) {
    console.error('Error in updateActivity:', err);
    return null;
  }
}

/**
 * Delete an activity (hard delete since activities don't have is_active)
 * Note: This will fail if activity is referenced by league activities
 * @param accessToken - Supabase access token for admin auth (required for RLS)
 */
export async function deleteActivity(activityId: string, accessToken?: string): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceRole();
    
    // Verify admin access if token provided
    if (accessToken) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
      if (authError || !user) {
        console.error('Unauthorized: Invalid authentication');
        return false;
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('platform_role')
        .eq('user_id', user.id)
        .single();

      if (userError || userData?.platform_role !== 'admin') {
        console.error('Forbidden: Admin access required');
        return false;
      }
    }
    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('activity_id', activityId);

    if (error) {
      console.error('Error deleting activity:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in deleteActivity:', err);
    return false;
  }
}

/**
 * Get activity statistics for dashboard
 */
export async function getActivityStats(): Promise<{
  total: number;
  usedInLeagues: number;
}> {
  try {
    const supabase = getSupabaseServiceRole();

    // Get total activities
    const { count: total } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true });

    // Get activities used in leagues
    const { data: usedActivities } = await supabase
      .from('leagueactivities')
      .select('activity_id');

    const uniqueUsedActivities = new Set(
      (usedActivities || []).map((a) => a.activity_id)
    );

    return {
      total: total || 0,
      usedInLeagues: uniqueUsedActivities.size,
    };
  } catch (err) {
    console.error('Error in getActivityStats:', err);
    return { total: 0, usedInLeagues: 0 };
  }
}
