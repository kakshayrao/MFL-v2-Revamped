/**
 * League Service Layer
 * Handles all league CRUD operations and queries.
 * Centralizes DB logic to avoid duplication across API routes and components.
 */

import { getSupabaseServiceRole } from '@/lib/supabase/client';
import { getTeamsForLeague } from '@/lib/services/teams';
import { TierPricingService } from '@/lib/services/tier-pricing';

export interface LeagueInput {
  league_name: string;
  description?: string | null;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  tier_id?: string; // references league_tiers
  num_teams?: number;
  max_participants?: number;
  rest_days?: number;
  auto_rest_day_enabled?: boolean;
  normalize_points_by_capacity?: boolean;
  is_public?: boolean;
  is_exclusive?: boolean;
}

export interface League extends LeagueInput {
  league_id: string;
  status: 'draft' | 'payment_pending' | 'scheduled' | 'active' | 'ended' | 'completed' | 'cancelled' | 'abandoned';
  is_active: boolean;
  invite_code: string | null;
  created_by: string;
  created_date: string;
  modified_by: string;
  modified_date: string;
  league_capacity?: number; // Derived from tier
}

function mapDbLeagueToLeague(dbLeague: any): League {
  if (!dbLeague) return dbLeague;
  return dbLeague as League;
}

function mapLeagueInputToDbUpdates(input: Partial<LeagueInput>): Record<string, any> {
  return { ...input };
}

/**
 * Generate a unique 8-character invite code
 */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, 1, I)
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create a new league
 * @param userId - User ID (will be set as host)
 * @param data - League creation data
 * @returns Created league object
 */
export async function createLeague(userId: string, data: LeagueInput): Promise<League | null> {
  try {
    const supabase = getSupabaseServiceRole();

    // Determine initial status based on start date
    const startDate = new Date(data.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);

    // Default to 'scheduled' if start date is in the future, 'active' if today or past
    const initialStatus = startDate > today ? 'scheduled' : 'active';

    const { data: league, error } = await supabase
      .from('leagues')
      .insert({
        league_name: data.league_name,
        description: data.description || null,
        start_date: data.start_date,
        end_date: data.end_date,
        tier_id: data.tier_id || null,
        tier_snapshot: null, // Will be set by the caller (payment verify)
        num_teams: data.num_teams || 4,
        rest_days: data.rest_days || 1,
        auto_rest_day_enabled: data.auto_rest_day_enabled ?? false,
        is_public: data.is_public || false,
        is_exclusive: data.is_exclusive ?? true,
        invite_code: generateInviteCode(),
        status: initialStatus,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating league:', error);
      return null;
    }

    // Create league membership for the creator
    if (league) {
      const { error: memberError } = await supabase
        .from('leaguemembers')
        .insert({
          user_id: userId,
          league_id: league.league_id,
          created_by: userId,
        });

      if (memberError) {
        console.error('Error creating league membership:', memberError);
      }

      // Fetch both host and player roles
      const { data: roles, error: rolesError } = await supabase
        .from('roles')
        .select('role_id, role_name')
        .in('role_name', ['host', 'player']);

      if (rolesError || !roles || roles.length === 0) {
        console.error('Error fetching roles:', rolesError);
      } else {
        // Assign both host + player roles (per PRD: Host is also a Player)
        const roleInserts = roles.map((role) => ({
          league_id: league.league_id,
          user_id: userId,
          role_id: role.role_id,
          created_by: userId,
        }));

        const { error: assignError } = await supabase
          .from('assignedrolesforleague')
          .insert(roleInserts);

        if (assignError) {
          console.error('Error assigning roles:', assignError);
        }
      }
    }

    return mapDbLeagueToLeague(league);
  } catch (err) {
    console.error('League creation error:', err);
    return null;
  }
}

/**
 * Get a single league by ID
 * @param leagueId - League ID
 * @returns League object or null
 */
export async function getLeagueById(leagueId: string): Promise<League | null> {
  try {
    const supabase = getSupabaseServiceRole();
    
    // Fetch league without embedded join
    const { data, error } = await supabase
      .from('leagues')
      .select('*')
      .eq('league_id', leagueId)
      .single();

    if (error || !data) return null;
    
    // Fetch tier capacity separately if tier_id exists
    let leagueCapacity = 20;
    if (data.tier_id) {
      const { data: tierData } = await supabase
        .from('league_tiers')
        .select('league_capacity')
        .eq('tier_id', data.tier_id)
        .single();
      
      if (tierData?.league_capacity) {
        leagueCapacity = tierData.league_capacity;
      }
    }
    
    const leagueWithCapacity = {
      ...data,
      league_capacity: leagueCapacity,
    };
    
    return mapDbLeagueToLeague(leagueWithCapacity);
  } catch (err) {
    console.error('Error fetching league:', err);
    return null;
  }
}

/**
 * Get all leagues for a user
 * @param userId - User ID
 * @returns Array of leagues the user is a member of
 */
export async function getLeaguesForUser(userId: string): Promise<League[]> {
  try {
    const { data, error } = await getSupabaseServiceRole()
      .from('leaguemembers')
      .select('league_id, leagues(*)')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user leagues:', error);
      return [];
    }

    // Extract and deduplicate leagues (user may have multiple roles)
    const leaguesMap = new Map<string, League>();
    (data || []).forEach((row: any) => {
      if (row.leagues) {
        const league = mapDbLeagueToLeague(row.leagues);
        leaguesMap.set(league.league_id, league);
      }
    });

    return Array.from(leaguesMap.values());
  } catch (err) {
    console.error('Error fetching user leagues:', err);
    return [];
  }
}

/**
 * Update a league
 * @param leagueId - League ID
 * @param userId - User ID (must be host to update)
 * @param data - Partial league data to update
 * @returns Updated league or null
 */
export async function updateLeague(
  leagueId: string,
  userId: string,
  data: Partial<LeagueInput>
): Promise<League | null> {
  try {
    // Verify user is host
    const league = await getLeagueById(leagueId);
    if (!league) return null;

    const userRole = await getUserRoleInLeague(userId, leagueId);
    if (userRole !== 'host') {
      console.error('User is not host of league');
      return null;
    }

    const isDraft = league.status === 'draft';

    // Only allow a restricted set of fields once the league is launched/active
    const allowedUpdates: Partial<LeagueInput> = {};

    if (isDraft) {
      Object.assign(allowedUpdates, data);
    } else if (league.status === 'launched' || league.status === 'active') {
      if (data.rest_days !== undefined) allowedUpdates.rest_days = data.rest_days;
      if (data.auto_rest_day_enabled !== undefined) {
        allowedUpdates.auto_rest_day_enabled = data.auto_rest_day_enabled;
      }
      if (data.description !== undefined) allowedUpdates.description = data.description;

    }

    if (Object.keys(allowedUpdates).length === 0) {
      console.error('No updatable fields for current league status');
      return null;
    }

    const { data: updated, error } = await getSupabaseServiceRole()
      .from('leagues')
      .update({
        ...mapLeagueInputToDbUpdates(allowedUpdates),
        modified_by: userId,
        modified_date: new Date().toISOString(),
      })
      .eq('league_id', leagueId)
      .select()
      .single();

    if (error) {
      console.error('Error updating league:', error);
      return null;
    }

    return mapDbLeagueToLeague(updated);
  } catch (err) {
    console.error('Error updating league:', err);
    return null;
  }
}

/**
 * Delete a league (host only, before launch)
 * @param leagueId - League ID
 * @param userId - User ID (must be host)
 * @returns Success boolean
 */
export async function deleteLeague(leagueId: string, userId: string): Promise<boolean> {
  try {
    const league = await getLeagueById(leagueId);
    if (!league) return false;

    const userRole = await getUserRoleInLeague(userId, leagueId);
    if (userRole !== 'host') {
      console.error('User is not host of league');
      return false;
    }

    if (league.status !== 'draft') {
      console.error('Cannot delete league after launch');
      return false;
    }

    const { error } = await getSupabaseServiceRole()
      .from('leagues')
      .delete()
      .eq('league_id', leagueId);

    return !error;
  } catch (err) {
    console.error('Error deleting league:', err);
    return false;
  }
}

/**
 * Launch a league (change status from draft to launched)
 * @param leagueId - League ID
 * @param userId - User ID (must be host)
 * @returns Updated league or null
 */
export async function launchLeague(leagueId: string, userId: string): Promise<League | null> {
  try {
    const league = await getLeagueById(leagueId);
    if (!league) return null;

    const userRole = await getUserRoleInLeague(userId, leagueId);
    if (userRole !== 'host') {
      console.error('User is not host of league');
      return null;
    }

    const { data, error } = await getSupabaseServiceRole()
      .from('leagues')
      .update({
        status: 'launched',
        modified_by: userId,
        modified_date: new Date().toISOString(),
      })
      .eq('league_id', leagueId)
      .select()
      .single();

    if (error) {
      console.error('Error launching league:', error);
      return null;
    }

    return data as League;
  } catch (err) {
    console.error('Error launching league:', err);
    return null;
  }
}

/**
 * Get user's role in a specific league
 * @param userId - User ID
 * @param leagueId - League ID
 * @returns Role name or null if user is not a member
 */
export async function getUserRoleInLeague(
  userId: string,
  leagueId: string
): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseServiceRole()
      .from('assignedrolesforleague')
      .select('roles(role_name)')
      .eq('user_id', userId)
      .eq('league_id', leagueId);

    if (error || !data || data.length === 0) return null;

    const roleNames = (data as any[])
      .map((row) => row.roles?.role_name)
      .filter(Boolean) as string[];

    if (roleNames.includes('host')) return 'host';
    if (roleNames.includes('governor')) return 'governor';
    if (roleNames.includes('captain')) return 'captain';
    if (roleNames.includes('player')) return 'player';
    return roleNames[0] || null;
  } catch (err) {
    console.error('Error fetching user role:', err);
    return null;
  }
}

/**
 * Get all roles assigned to a user in a league
 * @param userId - User ID
 * @param leagueId - League ID
 * @returns Array of role names
 */
export async function getUserRolesInLeague(
  userId: string,
  leagueId: string
): Promise<string[]> {
  try {
    const { data, error } = await getSupabaseServiceRole()
      .from('assignedrolesforleague')
      .select('roles(role_name)')
      .eq('user_id', userId)
      .eq('league_id', leagueId);

    if (error) return [];
    return (data || []).map((row: any) => row.roles?.role_name).filter(Boolean);
  } catch (err) {
    console.error('Error fetching user roles:', err);
    return [];
  }
}

/**
 * Assign a role to a user in a league
 * @param userId - User ID
 * @param leagueId - League ID
 * @param roleName - Role name (e.g., 'host', 'governor', 'captain', 'player')
 * @param assignedBy - User ID of who is assigning the role
 * @returns Success boolean
 */
export async function assignRoleToUser(
  userId: string,
  leagueId: string,
  roleName: string,
  assignedBy: string
): Promise<boolean> {
  try {
    // Get role_id from role_name
    const { data: roleData, error: roleError } = await getSupabaseServiceRole()
      .from('roles')
      .select('role_id')
      .eq('role_name', roleName)
      .single();

    if (roleError || !roleData) {
      console.error('Role not found:', roleName);
      return false;
    }

    // Check if assignment already exists
    const { data: existing } = await getSupabaseServiceRole()
      .from('assignedrolesforleague')
      .select('id')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('role_id', roleData.role_id)
      .maybeSingle();

    if (existing) {
      // Already assigned
      return true;
    }

    const { error } = await getSupabaseServiceRole()
      .from('assignedrolesforleague')
      .insert({
        user_id: userId,
        league_id: leagueId,
        role_id: roleData.role_id,
        created_by: assignedBy,
      });

    return !error;
  } catch (err) {
    console.error('Error assigning role:', err);
    return false;
  }
}

/**
 * Remove a role from a user in a league
 * @param userId - User ID
 * @param leagueId - League ID
 * @param roleName - Role name
 * @returns Success boolean
 */
export async function removeRoleFromUser(
  userId: string,
  leagueId: string,
  roleName: string
): Promise<boolean> {
  try {
    const { data: roleData, error: roleError } = await getSupabaseServiceRole()
      .from('roles')
      .select('role_id')
      .eq('role_name', roleName)
      .single();

    if (roleError || !roleData) return false;

    const { error } = await getSupabaseServiceRole()
      .from('assignedrolesforleague')
      .delete()
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('role_id', roleData.role_id);

    return !error;
  } catch (err) {
    console.error('Error removing role:', err);
    return false;
  }
}
