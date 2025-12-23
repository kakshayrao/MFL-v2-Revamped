/**
 * Teams Service - Team data operations
 * Handles team queries, member lookups, team creation and management
 * Uses teamleagues table to link teams to leagues (per DB schema)
 */
import { getSupabaseServiceRole } from '@/lib/supabase/client';
import { generateInviteCode } from './invites';

// ============================================================================
// Types
// ============================================================================

export interface Team {
  team_id: string;
  team_name: string;
  invite_code: string | null;
  created_by: string | null;
  created_date: string;
  modified_by: string | null;
  modified_date: string;
}

export interface TeamWithLeague extends Team {
  league_id: string;
  member_count?: number;
  captain?: {
    user_id: string;
    username: string;
  } | null;
}

export interface TeamMember {
  league_member_id: string;
  user_id: string;
  team_id: string | null;
  league_id: string;
  username: string;
  email: string;
  is_captain: boolean;
  roles: string[];
}

export interface LeagueMemberWithDetails {
  league_member_id: string;
  user_id: string;
  team_id: string | null;
  league_id: string;
  username: string;
  email: string;
  roles: string[];
  team_name?: string | null;
}

// ============================================================================
// Team CRUD Operations
// ============================================================================

/**
 * Get all teams for a specific league
 * Includes member count and captain info
 */
export async function getTeamsForLeague(leagueId: string): Promise<TeamWithLeague[]> {
  try {
    const supabase = getSupabaseServiceRole();

    // Get team IDs linked to this league
    const { data: teamLinks, error: linkError } = await supabase
      .from('teamleagues')
      .select('team_id')
      .eq('league_id', leagueId);

    if (linkError || !teamLinks || teamLinks.length === 0) {
      return [];
    }

    const teamIds = teamLinks.map((tl) => tl.team_id);

    // Get teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .in('team_id', teamIds);

    if (teamsError || !teams) {
      return [];
    }

    // Get member counts and captain info for each team
    const teamsWithDetails = await Promise.all(
      teams.map(async (team) => {
        // Get member count
        const { count } = await supabase
          .from('leaguemembers')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.team_id)
          .eq('league_id', leagueId);

        // Get captain (user with captain role in this league who is on this team)
        const { data: captainData } = await supabase
          .from('leaguemembers')
          .select(`
            user_id,
            users!leaguemembers_user_id_fkey(username)
          `)
          .eq('team_id', team.team_id)
          .eq('league_id', leagueId);

        let captain = null;
        if (captainData && captainData.length > 0) {
          // Check which member has captain role
          for (const member of captainData) {
            const { data: roleCheck } = await supabase
              .from('assignedrolesforleague')
              .select('roles!inner(role_name)')
              .eq('user_id', member.user_id)
              .eq('league_id', leagueId)
              .eq('roles.role_name', 'captain')
              .maybeSingle();

            if (roleCheck) {
              captain = {
                user_id: member.user_id,
                username: (member.users as any)?.username || 'Unknown',
              };
              break;
            }
          }
        }

        return {
          ...team,
          league_id: leagueId,
          member_count: count || 0,
          captain,
        } as TeamWithLeague;
      })
    );

    return teamsWithDetails;
  } catch (err) {
    console.error('Error fetching teams for league:', err);
    return [];
  }
}

/**
 * Get count of teams in a league
 */
export async function getTeamCountForLeague(leagueId: string): Promise<number> {
  try {
    const { count, error } = await getSupabaseServiceRole()
      .from('teamleagues')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId);

    return count || 0;
  } catch (err) {
    console.error('Error getting team count:', err);
    return 0;
  }
}

/**
 * Create a team for a league
 * Creates team in teams table and links via teamleagues
 */
export async function createTeamForLeague(
  leagueId: string,
  teamName: string,
  createdBy: string
): Promise<TeamWithLeague | null> {
  try {
    const supabase = getSupabaseServiceRole();

    // Check if team name already exists IN THIS LEAGUE
    // Since teams can be in multiple leagues, we need to check the combination
    const { data: existingTeamsInLeague } = await supabase
      .from('teamleagues')
      .select(`
        teams!inner(team_id, team_name)
      `)
      .eq('league_id', leagueId);

    const teamNameExists = (existingTeamsInLeague || []).some(
      (tl: any) => tl.teams?.team_name?.toLowerCase() === teamName.toLowerCase()
    );

    if (teamNameExists) {
      console.error('Team name already exists in this league');
      return null;
    }

    // Create the team with auto-generated invite code
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        team_name: teamName,
        invite_code: generateInviteCode(),
        created_by: createdBy,
      })
      .select()
      .single();

    if (teamError || !team) {
      console.error('Error creating team:', teamError);
      return null;
    }

    // Link team to league via teamleagues
    const { error: linkError } = await supabase
      .from('teamleagues')
      .insert({
        team_id: team.team_id,
        league_id: leagueId,
        created_by: createdBy,
      });

    if (linkError) {
      console.error('Error linking team to league:', linkError);
      // Rollback: delete the team
      await supabase.from('teams').delete().eq('team_id', team.team_id);
      return null;
    }

    return {
      ...team,
      league_id: leagueId,
      member_count: 0,
      captain: null,
    };
  } catch (err) {
    console.error('Error in createTeamForLeague:', err);
    return null;
  }
}

/**
 * Delete a team from a league
 * Removes teamleagues link and unassigns members
 */
export async function deleteTeamFromLeague(
  teamId: string,
  leagueId: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceRole();

    // Unassign all members from this team in this league
    const { error: unassignError } = await supabase
      .from('leaguemembers')
      .update({ team_id: null })
      .eq('team_id', teamId)
      .eq('league_id', leagueId);

    if (unassignError) {
      console.error('Error unassigning members:', unassignError);
    }

    // Remove captain role from anyone who was captain of this team
    // (They keep player role)

    // Remove the teamleagues link
    const { error: linkError } = await supabase
      .from('teamleagues')
      .delete()
      .eq('team_id', teamId)
      .eq('league_id', leagueId);

    if (linkError) {
      console.error('Error removing team link:', linkError);
      return false;
    }

    // Check if team is linked to any other leagues
    const { count } = await supabase
      .from('teamleagues')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', teamId);

    // If not linked to any league, delete the team itself
    if (count === 0) {
      await supabase.from('teams').delete().eq('team_id', teamId);
    }

    return true;
  } catch (err) {
    console.error('Error deleting team:', err);
    return false;
  }
}

/**
 * Update team name
 */
export async function updateTeam(
  teamId: string,
  teamName: string,
  modifiedBy: string
): Promise<Team | null> {
  try {
    const { data, error } = await getSupabaseServiceRole()
      .from('teams')
      .update({
        team_name: teamName,
        modified_by: modifiedBy,
        modified_date: new Date().toISOString(),
      })
      .eq('team_id', teamId)
      .select()
      .single();

    if (error) {
      console.error('Error updating team:', error);
      return null;
    }

    return data as Team;
  } catch (err) {
    console.error('Error in updateTeam:', err);
    return null;
  }
}

// ============================================================================
// Team Member Operations
// ============================================================================

/**
 * Get all members of a team with user details and roles
 */
export async function getTeamMembers(
  teamId: string,
  leagueId: string
): Promise<TeamMember[]> {
  try {
    const supabase = getSupabaseServiceRole();

    const { data: members, error } = await supabase
      .from('leaguemembers')
      .select(`
        league_member_id,
        user_id,
        team_id,
        league_id,
        users!leaguemembers_user_id_fkey(username, email)
      `)
      .eq('team_id', teamId)
      .eq('league_id', leagueId);

    console.log('[getTeamMembers] Query params - teamId:', teamId, 'leagueId:', leagueId);
    console.log('[getTeamMembers] Query error:', error);
    console.log('[getTeamMembers] Raw members response:', members);

    if (error || !members) {
      console.log('[getTeamMembers] Returning empty array - error:', error);
      return [];
    }

    console.log('[getTeamMembers] Found', members.length, 'members');

    // Get roles for each member
    const membersWithRoles = await Promise.all(
      members.map(async (member) => {
        const { data: rolesData } = await supabase
          .from('assignedrolesforleague')
          .select('roles!inner(role_name)')
          .eq('user_id', member.user_id)
          .eq('league_id', leagueId);

        const roles = (rolesData || []).map((r: any) => r.roles?.role_name).filter(Boolean);
        const isCaptain = roles.includes('captain');

        return {
          league_member_id: member.league_member_id,
          user_id: member.user_id,
          team_id: member.team_id,
          league_id: member.league_id,
          username: (member.users as any)?.username || 'Unknown',
          email: (member.users as any)?.email || '',
          is_captain: isCaptain,
          roles,
        } as TeamMember;
      })
    );

    console.log('[getTeamMembers] Returning members with roles:', membersWithRoles);
    return membersWithRoles;
  } catch (err) {
    console.error('[getTeamMembers] Error:', err);
    return [];
  }
}

/**
 * Get all league members with their team assignments
 * Returns both allocated and unallocated members
 */
export async function getLeagueMembersWithTeams(
  leagueId: string
): Promise<{ allocated: LeagueMemberWithDetails[]; unallocated: LeagueMemberWithDetails[] }> {
  try {
    const supabase = getSupabaseServiceRole();

    const { data: members, error } = await supabase
      .from('leaguemembers')
      .select(`
        league_member_id,
        user_id,
        team_id,
        league_id,
        users!leaguemembers_user_id_fkey(username, email),
        teams(team_name)
      `)
      .eq('league_id', leagueId);

    console.log('[getLeagueMembersWithTeams] leagueId:', leagueId, 'members found:', members?.length || 0, 'error:', error?.message);

    if (error || !members) {
      console.log('[getLeagueMembersWithTeams] Returning empty - error:', error);
      return { allocated: [], unallocated: [] };
    }

    // Get roles for each member
    const membersWithDetails = await Promise.all(
      members.map(async (member) => {
        const { data: rolesData } = await supabase
          .from('assignedrolesforleague')
          .select('roles!inner(role_name)')
          .eq('user_id', member.user_id)
          .eq('league_id', leagueId);

        const roles = (rolesData || []).map((r: any) => r.roles?.role_name).filter(Boolean);

        return {
          league_member_id: member.league_member_id,
          user_id: member.user_id,
          team_id: member.team_id,
          league_id: member.league_id,
          username: (member.users as any)?.username || 'Unknown',
          email: (member.users as any)?.email || '',
          roles,
          team_name: (member.teams as any)?.team_name || null,
        } as LeagueMemberWithDetails;
      })
    );

    const allocated = membersWithDetails.filter((m) => m.team_id !== null);
    const unallocated = membersWithDetails.filter((m) => m.team_id === null);

    return { allocated, unallocated };
  } catch (err) {
    console.error('Error fetching league members:', err);
    return { allocated: [], unallocated: [] };
  }
}

/**
 * Assign a member to a team
 */
export async function assignMemberToTeam(
  leagueMemberId: string,
  teamId: string,
  modifiedBy: string
): Promise<boolean> {
  try {
    const { error } = await getSupabaseServiceRole()
      .from('leaguemembers')
      .update({
        team_id: teamId,
        modified_by: modifiedBy,
        modified_date: new Date().toISOString(),
      })
      .eq('league_member_id', leagueMemberId);

    return !error;
  } catch (err) {
    console.error('Error assigning member to team:', err);
    return false;
  }
}

/**
 * Remove member from team (set team_id to null)
 */
export async function removeMemberFromTeam(
  leagueMemberId: string,
  modifiedBy: string
): Promise<boolean> {
  try {
    const { error } = await getSupabaseServiceRole()
      .from('leaguemembers')
      .update({
        team_id: null,
        modified_by: modifiedBy,
        modified_date: new Date().toISOString(),
      })
      .eq('league_member_id', leagueMemberId);

    return !error;
  } catch (err) {
    console.error('Error removing member from team:', err);
    return false;
  }
}

// ============================================================================
// Role Assignment Operations
// ============================================================================

/**
 * Assign captain role to a team member
 * Rules:
 * - Captain must be a member of the team
 * - A user can only be captain of one team in a league
 * - Previous captain of this team loses captain role
 */
export async function assignCaptain(
  userId: string,
  teamId: string,
  leagueId: string,
  assignedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseServiceRole();

    // Verify user is a member of this team
    const { data: memberCheck } = await supabase
      .from('leaguemembers')
      .select('league_member_id')
      .eq('user_id', userId)
      .eq('team_id', teamId)
      .eq('league_id', leagueId)
      .maybeSingle();

    if (!memberCheck) {
      return { success: false, error: 'User is not a member of this team' };
    }

    // Check if user is already captain of another team in this league
    const { data: existingCaptainRole } = await supabase
      .from('assignedrolesforleague')
      .select('id, roles!inner(role_name)')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('roles.role_name', 'captain')
      .maybeSingle();

    if (existingCaptainRole) {
      return { success: false, error: 'User is already a captain in this league' };
    }

    // Get captain role_id
    const { data: captainRole } = await supabase
      .from('roles')
      .select('role_id')
      .eq('role_name', 'captain')
      .single();

    if (!captainRole) {
      return { success: false, error: 'Captain role not found' };
    }

    // Remove captain role from current captain of this team (if any)
    const teamMembers = await getTeamMembers(teamId, leagueId);
    const currentCaptain = teamMembers.find((m) => m.is_captain);

    if (currentCaptain) {
      await supabase
        .from('assignedrolesforleague')
        .delete()
        .eq('user_id', currentCaptain.user_id)
        .eq('league_id', leagueId)
        .eq('role_id', captainRole.role_id);
    }

    // Assign captain role to new user
    const { error: assignError } = await supabase
      .from('assignedrolesforleague')
      .insert({
        user_id: userId,
        league_id: leagueId,
        role_id: captainRole.role_id,
        created_by: assignedBy,
      });

    if (assignError) {
      console.error('Error assigning captain role:', assignError);
      return { success: false, error: 'Failed to assign captain role' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in assignCaptain:', err);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Remove captain role from a user
 */
export async function removeCaptain(
  userId: string,
  leagueId: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceRole();

    const { data: captainRole } = await supabase
      .from('roles')
      .select('role_id')
      .eq('role_name', 'captain')
      .single();

    if (!captainRole) return false;

    const { error } = await supabase
      .from('assignedrolesforleague')
      .delete()
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('role_id', captainRole.role_id);

    return !error;
  } catch (err) {
    console.error('Error removing captain:', err);
    return false;
  }
}

/**
 * Assign governor role to a user
 * Rules:
 * - Multiple governors can be assigned per league
 * - Governor must be a league member
 * - Host cannot be assigned as governor (already has all permissions)
 */
export async function assignGovernor(
  userId: string,
  leagueId: string,
  assignedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseServiceRole();

    // Verify user is a member of this league
    const { data: memberCheck } = await supabase
      .from('leaguemembers')
      .select('league_member_id')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .maybeSingle();

    if (!memberCheck) {
      return { success: false, error: 'User is not a member of this league' };
    }

    // Check if user is host (cannot be governor too) - host is the league creator (created_by)
    const { data: league } = await supabase
      .from('leagues')
      .select('created_by')
      .eq('league_id', leagueId)
      .single();

    if (league?.created_by === userId) {
      return { success: false, error: 'Host cannot be assigned as governor' };
    }

    // Get governor role_id
    const { data: governorRole } = await supabase
      .from('roles')
      .select('role_id')
      .eq('role_name', 'governor')
      .single();

    if (!governorRole) {
      return { success: false, error: 'Governor role not found' };
    }

    // Check if user already has governor role
    const { data: existingAssignment } = await supabase
      .from('assignedrolesforleague')
      .select('id')
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('role_id', governorRole.role_id)
      .maybeSingle();

    if (existingAssignment) {
      return { success: false, error: 'User is already a governor' };
    }

    // Assign governor role
    const { error: assignError } = await supabase
      .from('assignedrolesforleague')
      .insert({
        user_id: userId,
        league_id: leagueId,
        role_id: governorRole.role_id,
        created_by: assignedBy,
      });

    if (assignError) {
      console.error('Error assigning governor role:', assignError);
      return { success: false, error: 'Failed to assign governor role' };
    }

    return { success: true };
  } catch (err) {
    console.error('Error in assignGovernor:', err);
    return { success: false, error: 'An error occurred' };
  }
}

/**
 * Remove governor role from a user
 */
export async function removeGovernor(
  userId: string,
  leagueId: string
): Promise<boolean> {
  try {
    const supabase = getSupabaseServiceRole();

    const { data: governorRole } = await supabase
      .from('roles')
      .select('role_id')
      .eq('role_name', 'governor')
      .single();

    if (!governorRole) return false;

    const { error } = await supabase
      .from('assignedrolesforleague')
      .delete()
      .eq('user_id', userId)
      .eq('league_id', leagueId)
      .eq('role_id', governorRole.role_id);

    return !error;
  } catch (err) {
    console.error('Error removing governor:', err);
    return false;
  }
}

/**
 * Get all current governors of a league
 */
export async function getLeagueGovernors(
  leagueId: string
): Promise<{ user_id: string; username: string }[]> {
  try {
    const supabase = getSupabaseServiceRole();

    const { data: governorRole } = await supabase
      .from('roles')
      .select('role_id')
      .eq('role_name', 'governor')
      .single();

    if (!governorRole) return [];

    const { data: governors } = await supabase
      .from('assignedrolesforleague')
      .select('user_id')
      .eq('league_id', leagueId)
      .eq('role_id', governorRole.role_id);

    if (!governors || governors.length === 0) return [];

    const userIds = governors.map(g => g.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('user_id, username')
      .in('user_id', userIds);

    if (!users) return [];

    return users.map(user => ({
      user_id: user.user_id,
      username: user.username || 'Unknown',
    }));
  } catch (err) {
    console.error('Error getting governors:', err);
    return [];
  }
}

// ============================================================================
// Legacy exports for backward compatibility
// ============================================================================

export async function getTeamNameForUser(userId: string): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseServiceRole()
      .from('leaguemembers')
      .select('teams(team_name)')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return null;
    return (data as any)?.teams?.team_name || null;
  } catch (err) {
    console.error('Error fetching team name for user:', err);
    return null;
  }
}

export async function getTeamById(teamId: string): Promise<Team | null> {
  try {
    const { data, error } = await getSupabaseServiceRole()
      .from('teams')
      .select('*')
      .eq('team_id', teamId)
      .single();

    if (error || !data) return null;
    return data as Team;
  } catch (err) {
    console.error('Error fetching team by ID:', err);
    return null;
  }
}
