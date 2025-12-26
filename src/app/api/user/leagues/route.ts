import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

// ============================================================================
// GET /api/user/leagues
// ============================================================================

/**
 * Fetches all leagues for the current user with their roles in each league.
 *
 * Returns:
 * - league_id, name, description, cover_image, status
 * - roles: Array of role names the user has in this league
 * - team_id, team_name: The user's team in this league (if any)
 * - is_host: Boolean indicating if user is the league host
 */
export async function GET() {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    const userId = (session?.user as any)?.id || (session?.user as any)?.user_id;

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseServiceRole();

    // Get all league memberships for the user with league details
    const { data: memberships, error: membershipError } = await supabase
      .from('leaguemembers')
      .select(`
        league_id,
        team_id,
        leagues (
          league_id,
          league_name,
          description,
          status,
          start_date,
          end_date,
          num_teams,
          team_size,
          is_public,
          is_exclusive,
          invite_code,
          created_by
        ),
        teams (
          team_id,
          team_name
        )
      `)
      .eq('user_id', userId);

    if (membershipError) {
      console.error('Error fetching memberships:', membershipError);
      return NextResponse.json({ error: 'Failed to fetch leagues' }, { status: 500 });
    }

    // Get all role assignments for the user
    const { data: roleAssignments, error: roleError } = await supabase
      .from('assignedrolesforleague')
      .select(`
        league_id,
        roles (
          role_name
        )
      `)
      .eq('user_id', userId);

    if (roleError) {
      console.error('Error fetching roles:', roleError);
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }

    // Build a map of league_id -> roles[]
    const rolesMap = new Map<string, string[]>();
    (roleAssignments || []).forEach((assignment: any) => {
      const leagueId = assignment.league_id;
      const roleName = assignment.roles?.role_name;
      if (leagueId && roleName) {
        if (!rolesMap.has(leagueId)) {
          rolesMap.set(leagueId, []);
        }
        rolesMap.get(leagueId)!.push(roleName);
      }
    });

    // Build the response
    const leagues = (memberships || []).map((membership: any) => {
      const league = membership.leagues;
      const team = membership.teams;
      const leagueId = league?.league_id;
      const roles = rolesMap.get(leagueId) || [];

      // Check if user is host (created the league or has host role)
      const isHost = league?.created_by === userId || roles.includes('host');

      // If user has no explicit roles but is a member, they're at least a player
      if (roles.length === 0) {
        roles.push('player');
      }

      return {
        league_id: leagueId,
        name: league?.league_name || 'Unknown League',
        description: league?.description || null,
        status: league?.status || 'draft',
        start_date: league?.start_date || null,
        end_date: league?.end_date || null,
        num_teams: league?.num_teams || 4,
        team_capacity: league?.team_size || 5,
        is_public: league?.is_public || false,
        is_exclusive: league?.is_exclusive || true,
        invite_code: league?.invite_code || null,
        roles: roles,
        team_id: team?.team_id || null,
        team_name: team?.team_name || null,
        is_host: isHost,
      };
    });

    // Remove duplicates (user might have multiple entries)
    const uniqueLeagues = Array.from(
      new Map(leagues.map((l: any) => [l.league_id, l])).values()
    );

    return NextResponse.json({ leagues: uniqueLeagues });
  } catch (err) {
    console.error('Error in /api/user/leagues:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
