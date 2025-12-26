/**
 * Admin Users Service
 * Handles all user CRUD operations for the admin panel
 */

import type {
  AdminUser,
  AdminUserCreateInput,
  AdminUserUpdateInput,
  AdminUserFilters,
} from '@/types/admin';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

/**
 * Get all users with optional filters
 */
export async function getAllUsers(filters?: AdminUserFilters): Promise<AdminUser[]> {
  try {
    const supabase = getSupabaseServiceRole();
    let query = supabase
      .from('users')
      .select('*')
      .order('created_date', { ascending: false });

    // Apply filters
    if (filters?.search) {
      query = query.or(
        `username.ilike.%${filters.search}%,email.ilike.%${filters.search}%`
      );
    }

    if (filters?.platform_role && filters.platform_role !== 'all') {
      query = query.eq('platform_role', filters.platform_role);
    }

    if (filters?.is_active !== undefined && filters.is_active !== 'all') {
      query = query.eq('is_active', filters.is_active);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }

    return (data || []) as AdminUser[];
  } catch (err) {
    console.error('Error in getAllUsers:', err);
    return [];
  }
}

/**
 * Get a single user by ID
 */
export async function getUserById(userId: string): Promise<AdminUser | null> {
  try {
    const supabase = getSupabaseServiceRole();
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }

    return data as AdminUser;
  } catch (err) {
    console.error('Error in getUserById:', err);
    return null;
  }
}

/**
 * Create a new user
 * @param accessToken - Supabase access token for admin auth (required for RLS)
 */
export async function createUser(
  input: AdminUserCreateInput,
  accessToken?: string,
  createdBy?: string
): Promise<AdminUser | null> {
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
      .from('users')
      .insert({
        ...input,
        platform_role: input.platform_role || 'user',
        is_active: true,
        created_by: createdBy || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user:', error);
      return null;
    }

    return data as AdminUser;
  } catch (err) {
    console.error('Error in createUser:', err);
    return null;
  }
}

/**
 * Update an existing user
 * @param accessToken - Supabase access token for admin auth (required for RLS)
 */
export async function updateUser(
  userId: string,
  input: AdminUserUpdateInput,
  accessToken?: string,
  modifiedBy?: string
): Promise<AdminUser | null> {
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
      .from('users')
      .update({
        ...input,
        modified_by: modifiedBy || null,
        modified_date: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      return null;
    }

    return data as AdminUser;
  } catch (err) {
    console.error('Error in updateUser:', err);
    return null;
  }
}

/**
 * Soft delete a user (set is_active = false)
 * @param accessToken - Supabase access token for admin auth (required for RLS)
 */
export async function softDeleteUser(
  userId: string,
  accessToken?: string,
  modifiedBy?: string
): Promise<boolean> {
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
      
      if (!modifiedBy) {
        modifiedBy = user.id;
      }
    }
    const { error } = await supabase
      .from('users')
      .update({
        is_active: false,
        modified_by: modifiedBy || null,
        modified_date: new Date().toISOString(),
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error soft deleting user:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error in softDeleteUser:', err);
    return false;
  }
}

/**
 * Get user statistics for dashboard
 */
export async function getUserStats(): Promise<{
  total: number;
  active: number;
  admins: number;
  newThisMonth: number;
}> {
  try {
    const supabase = getSupabaseServiceRole();

    // Get total users
    const { count: total } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get active users
    const { count: active } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    // Get admin users
    const { count: admins } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('platform_role', 'admin');

    // Get users created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: newThisMonth } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_date', startOfMonth.toISOString());

    return {
      total: total || 0,
      active: active || 0,
      admins: admins || 0,
      newThisMonth: newThisMonth || 0,
    };
  } catch (err) {
    console.error('Error in getUserStats:', err);
    return { total: 0, active: 0, admins: 0, newThisMonth: 0 };
  }
}
