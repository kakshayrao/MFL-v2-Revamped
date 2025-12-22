/**
 * GET /api/leagues/[id]/challenges/[challengeId]/subteams - List sub-teams for a challenge
 * POST /api/leagues/[id]/challenges/[challengeId]/subteams - Create sub-team
 * PUT /api/leagues/[id]/challenges/[challengeId]/subteams/[subteamId] - Update sub-team
 * DELETE /api/leagues/[id]/challenges/[challengeId]/subteams/[subteamId] - Delete sub-team
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

type LeagueRole = 'host' | 'governor' | 'captain' | 'player' | null;

function buildError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function getMembership(userId: string, leagueId: string) {
  const supabase = getSupabaseServiceRole();
  
  const { data: memberData, error: memberError } = await supabase
    .from('leaguemembers')
    .select('league_member_id')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .maybeSingle();

  if (memberError || !memberData) {
    return null;
  }

  const { data: roleData, error: roleError } = await supabase
    .from('assignedrolesforleague')
    .select('roles(role_name)')
    .eq('user_id', userId)
    .eq('league_id', leagueId);

  if (roleError) {
    return null;
  }

  const roleNames = (roleData || []).map((r: any) => r.roles?.role_name).filter(Boolean);
  const primaryRole = (roleNames[0] as LeagueRole) ?? null;

  return {
    leagueMemberId: String(memberData.league_member_id),
    role: primaryRole,
  };
}

function isHostOrGovernor(role: LeagueRole): boolean {
  return role === 'host' || role === 'governor';
}

// GET - List sub-teams for a challenge
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; challengeId: string }> }
) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return buildError('Unauthorized', 401);
    }

    const { id: leagueId, challengeId } = await params;
    const supabase = getSupabaseServiceRole();

    const membership = await getMembership(session.user.id, leagueId);
    if (!membership) {
      return buildError('Not a member of this league', 403);
    }

    // Optional filter by teamId
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');

    // Fetch sub-teams with their members (optionally filtered by team)
    let query = supabase
      .from('challenge_subteams')
      .select(`
        subteam_id,
        name,
        team_id,
        teams(team_name),
        challenge_subteam_members(
          league_member_id,
          leaguemembers(
            user_id,
            users!leaguemembers_user_id_fkey(username)
          )
        )
      `)
      .eq('league_challenge_id', challengeId)
      .order('name');

    if (teamId) {
      query = query.eq('team_id', teamId);
    }

    const { data: subteams, error } = await query;

    if (error) {
      console.error('Error fetching sub-teams:', error);
      return buildError('Failed to fetch sub-teams', 500);
    }

    return NextResponse.json({ success: true, data: subteams || [] });
  } catch (err) {
    console.error('Unexpected error in GET sub-teams:', err);
    return buildError('Internal server error', 500);
  }
}

// POST - Create sub-team
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; challengeId: string }> }
) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return buildError('Unauthorized', 401);
    }

    const { id: leagueId, challengeId } = await params;
    const supabase = getSupabaseServiceRole();

    const membership = await getMembership(session.user.id, leagueId);
    if (!membership || !isHostOrGovernor(membership.role)) {
      return buildError('Only hosts/governors can create sub-teams', 403);
    }

    const body = await req.json();
    const { name, teamId, memberIds } = body;

    if (!name || !teamId) {
      return buildError('Name and teamId are required', 400);
    }

    // Create sub-team
    const { data: subteam, error: createError } = await supabase
      .from('challenge_subteams')
      .insert({
        league_challenge_id: challengeId,
        team_id: teamId,
        name,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating sub-team:', createError);
      return buildError('Failed to create sub-team', 500);
    }

    // Add members if provided
    if (memberIds && Array.isArray(memberIds) && memberIds.length > 0) {
      const memberRecords = memberIds.map((memberId: string) => ({
        subteam_id: subteam.subteam_id,
        league_member_id: memberId,
      }));

      const { error: membersError } = await supabase
        .from('challenge_subteam_members')
        .insert(memberRecords);

      if (membersError) {
        console.error('Error adding sub-team members:', membersError);
        // Don't fail the request, sub-team was created
      }
    }

    return NextResponse.json({ success: true, data: subteam });
  } catch (err) {
    console.error('Unexpected error in POST sub-team:', err);
    return buildError('Internal server error', 500);
  }
}
