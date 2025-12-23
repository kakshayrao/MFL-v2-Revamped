/**
 * GET /api/leagues/[id]/teams - List all teams in a league
 * POST /api/leagues/[id]/teams - Create a new team (Host/Governor only)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { z } from 'zod';
import {
  getTeamsForLeague,
  getTeamCountForLeague,
  createTeamForLeague,
  getLeagueMembersWithTeams,
  getLeagueGovernors,
} from '@/lib/services/teams';
import { getLeagueById } from '@/lib/services/leagues';
import { userHasAnyRole } from '@/lib/services/roles';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

const createTeamSchema = z.object({
  team_name: z.string().min(1, 'Team name is required').max(100, 'Team name too long'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is a member of this league (via leaguemembers or assignedrolesforleague)
    const supabase = getSupabaseServiceRole();

    // Check leaguemembers table
    const { data: memberCheck } = await supabase
      .from('leaguemembers')
      .select('league_member_id')
      .eq('user_id', session.user.id)
      .eq('league_id', leagueId)
      .maybeSingle();

    // Also check assignedrolesforleague (user might have role without being in leaguemembers)
    const hasRole = await userHasAnyRole(session.user.id, leagueId, [
      'host',
      'governor',
      'captain',
      'player',
    ]);

    if (!memberCheck && !hasRole) {
      return NextResponse.json(
        { error: 'You are not a member of this league' },
        { status: 403 }
      );
    }

    // Get league to check num_teams limit
    const league = await getLeagueById(leagueId);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    // Get teams with member counts and captain info
    const teams = await getTeamsForLeague(leagueId);

    // Get league members (allocated and unallocated)
    const { allocated, unallocated } = await getLeagueMembersWithTeams(leagueId);

    console.log('[GET Teams] League:', leagueId, 'Allocated:', allocated.length, 'Unallocated:', unallocated.length);
    console.log('[GET Teams] Unallocated members:', unallocated.map(m => ({ user_id: m.user_id, username: m.username })));

    // Get governors info
    const governors = await getLeagueGovernors(leagueId);

    return NextResponse.json({
      success: true,
      data: {
        teams,
        members: {
          allocated,
          unallocated,
        },
        governors,
        league: {
          league_id: league.league_id,
          league_name: league.league_name,
          num_teams: league.num_teams,
          team_size: league.team_size,
          status: league.status,
          host_user_id: league.created_by,
        },
        meta: {
          current_team_count: teams.length,
          max_teams: league.num_teams,
          can_create_more: teams.length < league.num_teams,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch teams' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leagueId } = await params;
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions (must be host or governor)
    const canCreate = await userHasAnyRole(session.user.id, leagueId, [
      'host',
      'governor',
    ]);

    console.log('[Create Team] User:', session.user.id, 'League:', leagueId, 'canCreate:', canCreate);

    if (!canCreate) {
      return NextResponse.json(
        { error: 'Only host or governor can create teams' },
        { status: 403 }
      );
    }

    // Get league to check limits
    const league = await getLeagueById(leagueId);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    // Check if max teams reached
    const currentCount = await getTeamCountForLeague(leagueId);
    if (currentCount >= league.num_teams) {
      return NextResponse.json(
        { error: `Maximum of ${league.num_teams} teams allowed for this league` },
        { status: 400 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validated = createTeamSchema.parse(body);

    // Create the team
    const team = await createTeamForLeague(
      leagueId,
      validated.team_name,
      session.user.id
    );

    if (!team) {
      return NextResponse.json(
        { error: 'Failed to create team. Team name may already exist.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: team },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating team:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create team' },
      { status: 500 }
    );
  }
}
