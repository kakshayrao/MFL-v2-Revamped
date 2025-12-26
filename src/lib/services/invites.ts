/**
 * Invites Service Layer
 * Handles league invitation operations including validation and joining.
 */

import { getSupabaseServiceRole } from '@/lib/supabase/client';

// ============================================================================
// Types
// ============================================================================

export interface LeagueInviteInfo {
  league_id: string;
  league_name: string;
  description: string | null;
  status: string;
  start_date: string;
  end_date: string;
  num_teams: number;
  team_capacity: number;
  is_public: boolean;
  member_count: number;
  max_capacity: number;
  is_full: boolean;
  can_join: boolean;
}

export interface TeamInviteInfo {
  team_id: string;
  team_name: string;
  league_id: string;
  league_name: string;
  league_description: string | null;
  league_status: string;
  start_date: string;
  end_date: string;
  team_member_count: number;
  team_max_capacity: number;
  is_team_full: boolean;
  can_join: boolean;
}

export interface JoinResult {
  success: boolean;
  alreadyMember?: boolean;
  leagueId?: string;
  leagueName?: string;
  teamId?: string;
  teamName?: string;
  error?: string;
}

// ============================================================================
// Functions
// ============================================================================

/**
 * Validate an invite code and get league information
 * This is a PUBLIC function - no auth required
 * @param code - The invite code to validate
 * @returns League info or null if invalid
 */
export async function validateInviteCode(code: string): Promise<LeagueInviteInfo | null> {
  try {
    const supabase = getSupabaseServiceRole();
    const normalizedCode = code.trim().toUpperCase();

    // Find league by invite_code
    const { data: league, error } = await supabase
      .from('leagues')
      .select('*')
      .eq('invite_code', normalizedCode)
      .single();

    if (error || !league) {
      return null;
    }

    // Get member count
    const { count: memberCount } = await supabase
      .from('leaguemembers')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', league.league_id);

    const maxCapacity = (league.num_teams || 4) * (league.team_size || 5);
    const currentCount = memberCount || 0;
    const isFull = currentCount >= maxCapacity;
    const canJoin = league.status !== 'completed' && !isFull;

    return {
      league_id: league.league_id,
      league_name: league.league_name,
      description: league.description,
      status: league.status,
      start_date: league.start_date,
      end_date: league.end_date,
      num_teams: league.num_teams || 4,
      team_capacity: league.team_size || 5,
      is_public: league.is_public || false,
      member_count: currentCount,
      max_capacity: maxCapacity,
      is_full: isFull,
      can_join: canJoin,
    };
  } catch (err) {
    console.error('Error validating invite code:', err);
    return null;
  }
}

/**
 * Join a league using an invite code
 * @param userId - The user ID joining
 * @param code - The invite code
 * @returns Join result
 */
export async function joinLeagueByCode(userId: string, code: string): Promise<JoinResult> {
  try {
    const supabase = getSupabaseServiceRole();
    const normalizedCode = code.trim().toUpperCase();

    // Validate the invite code first
    const leagueInfo = await validateInviteCode(normalizedCode);
    if (!leagueInfo) {
      return { success: false, error: 'Invalid invite code' };
    }

    if (!leagueInfo.can_join) {
      if (leagueInfo.is_full) {
        return { success: false, error: 'This league is full' };
      }
      return { success: false, error: 'This league is not accepting new members' };
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from('leaguemembers')
      .select('league_member_id')
      .eq('league_id', leagueInfo.league_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      return {
        success: true,
        alreadyMember: true,
        leagueId: leagueInfo.league_id,
        leagueName: leagueInfo.league_name,
      };
    }

    // Add user to leaguemembers (unassigned to any team)
    const { error: memberError } = await supabase
      .from('leaguemembers')
      .insert({
        user_id: userId,
        league_id: leagueInfo.league_id,
        team_id: null, // Unassigned - in allocation bucket
        created_by: userId,
      });

    if (memberError) {
      console.error('Error adding league member:', memberError);
      return { success: false, error: 'Failed to join league' };
    }

    // Assign player role
    const { data: playerRole } = await supabase
      .from('roles')
      .select('role_id')
      .eq('role_name', 'player')
      .single();

    if (playerRole) {
      await supabase
        .from('assignedrolesforleague')
        .insert({
          user_id: userId,
          league_id: leagueInfo.league_id,
          role_id: playerRole.role_id,
          created_by: userId,
        });
    }

    return {
      success: true,
      leagueId: leagueInfo.league_id,
      leagueName: leagueInfo.league_name,
    };
  } catch (err) {
    console.error('Error joining league by code:', err);
    return { success: false, error: 'Failed to join league' };
  }
}

/**
 * Get the invite link for a league
 * @param leagueId - The league ID
 * @param baseUrl - The base URL of the application
 * @returns The invite link
 */
export function getInviteLink(inviteCode: string, baseUrl: string): string {
  return `${baseUrl}/invite/${inviteCode}`;
}

/**
 * Check if a user is a member of a league
 * @param userId - The user ID
 * @param leagueId - The league ID
 * @returns True if member
 */
export async function isLeagueMember(userId: string, leagueId: string): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceRole();
    const { data } = await supabase
      .from('leaguemembers')
      .select('league_member_id')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .maybeSingle();

    return !!data;
  } catch (err) {
    console.error('Error checking league membership:', err);
    return false;
  }
}

// ============================================================================
// Team Invite Functions
// ============================================================================

/**
 * Generate a random invite code for a team
 * @param length - Code length (default 8)
 * @returns Random alphanumeric code
 */
export function generateInviteCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars (0, O, 1, I)
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Validate a team invite code and get team/league information
 * This is a PUBLIC function - no auth required
 * @param code - The team invite code to validate
 * @returns Team and league info or null if invalid
 */
export async function validateTeamInviteCode(code: string): Promise<TeamInviteInfo | null> {
  try {
    const supabase = getSupabaseServiceRole();
    const normalizedCode = code.trim().toUpperCase();

    // Find team by invite_code
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('team_id, team_name, invite_code')
      .eq('invite_code', normalizedCode)
      .single();

    if (teamError || !team) {
      return null;
    }

    // Get the league this team is in (via teamleagues junction)
    const { data: teamLeague, error: tlError } = await supabase
      .from('teamleagues')
      .select(`
        league_id,
        leagues:league_id (
          league_id,
          league_name,
          description,
          status,
          start_date,
          end_date,
          team_size
        )
      `)
      .eq('team_id', team.team_id)
      .single();

    if (tlError || !teamLeague || !teamLeague.leagues) {
      return null;
    }

    const league = teamLeague.leagues as any;

    // Get team member count in this league
    const { count: teamMemberCount } = await supabase
      .from('leaguemembers')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', league.league_id)
      .eq('team_id', team.team_id);

    const teamMaxCapacity = league.team_size || 5;
    const currentTeamCount = teamMemberCount || 0;
    const isTeamFull = currentTeamCount >= teamMaxCapacity;
    const canJoin = league.status !== 'completed' && !isTeamFull;

    return {
      team_id: team.team_id,
      team_name: team.team_name,
      league_id: league.league_id,
      league_name: league.league_name,
      league_description: league.description,
      league_status: league.status,
      start_date: league.start_date,
      end_date: league.end_date,
      team_member_count: currentTeamCount,
      team_max_capacity: teamMaxCapacity,
      is_team_full: isTeamFull,
      can_join: canJoin,
    };
  } catch (err) {
    console.error('Error validating team invite code:', err);
    return null;
  }
}

/**
 * Join a team (and its league) using a team invite code
 * @param userId - The user ID joining
 * @param code - The team invite code
 * @returns Join result
 */
export async function joinTeamByCode(userId: string, code: string): Promise<JoinResult> {
  try {
    const supabase = getSupabaseServiceRole();
    const normalizedCode = code.trim().toUpperCase();

    // Validate the team invite code first
    const teamInfo = await validateTeamInviteCode(normalizedCode);
    if (!teamInfo) {
      return { success: false, error: 'Invalid team invite code' };
    }

    if (!teamInfo.can_join) {
      if (teamInfo.is_team_full) {
        return { success: false, error: 'This team is full' };
      }
      return { success: false, error: 'This team is not accepting new members' };
    }

    // Check if user is already a member of this league
    const { data: existingMember } = await supabase
      .from('leaguemembers')
      .select('league_member_id, team_id')
      .eq('league_id', teamInfo.league_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingMember) {
      // User is already in the league
      if (existingMember.team_id === teamInfo.team_id) {
        // Already in this team
        return {
          success: true,
          alreadyMember: true,
          leagueId: teamInfo.league_id,
          leagueName: teamInfo.league_name,
          teamId: teamInfo.team_id,
          teamName: teamInfo.team_name,
        };
      } else if (existingMember.team_id) {
        // Already in a different team
        return {
          success: false,
          error: 'You are already assigned to a different team in this league',
        };
      } else {
        // In league but unassigned - assign to this team
        const { error: updateError } = await supabase
          .from('leaguemembers')
          .update({ team_id: teamInfo.team_id, modified_by: userId })
          .eq('league_member_id', existingMember.league_member_id);

        if (updateError) {
          console.error('Error assigning to team:', updateError);
          return { success: false, error: 'Failed to assign to team' };
        }

        return {
          success: true,
          leagueId: teamInfo.league_id,
          leagueName: teamInfo.league_name,
          teamId: teamInfo.team_id,
          teamName: teamInfo.team_name,
        };
      }
    }

    // New member - add to league with team assignment
    const { error: memberError } = await supabase
      .from('leaguemembers')
      .insert({
        user_id: userId,
        league_id: teamInfo.league_id,
        team_id: teamInfo.team_id, // Directly assigned to team
        created_by: userId,
      });

    if (memberError) {
      console.error('Error adding league member:', memberError);
      return { success: false, error: 'Failed to join team' };
    }

    // Assign player role
    const { data: playerRole } = await supabase
      .from('roles')
      .select('role_id')
      .eq('role_name', 'player')
      .single();

    if (playerRole) {
      await supabase
        .from('assignedrolesforleague')
        .insert({
          user_id: userId,
          league_id: teamInfo.league_id,
          role_id: playerRole.role_id,
          created_by: userId,
        });
    }

    return {
      success: true,
      leagueId: teamInfo.league_id,
      leagueName: teamInfo.league_name,
      teamId: teamInfo.team_id,
      teamName: teamInfo.team_name,
    };
  } catch (err) {
    console.error('Error joining team by code:', err);
    return { success: false, error: 'Failed to join team' };
  }
}

/**
 * Get the team invite link
 * @param inviteCode - The team's invite code
 * @param baseUrl - The base URL of the application
 * @returns The team invite link
 */
export function getTeamInviteLink(inviteCode: string, baseUrl: string): string {
  return `${baseUrl}/invite/team/${inviteCode}`;
}

