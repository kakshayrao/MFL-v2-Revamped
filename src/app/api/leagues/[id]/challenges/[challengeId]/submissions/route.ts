import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

type LeagueRole = 'host' | 'governor' | 'captain' | 'player' | null;

type Membership = {
  leagueMemberId: string;
  role: LeagueRole;
};

function buildError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function getMembership(userId: string, leagueId: string): Promise<Membership | null> {
  const supabase = getSupabaseServiceRole();
  
  // First check if user is a league member
  const { data: memberData, error: memberError } = await supabase
    .from('leaguemembers')
    .select('league_member_id')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .maybeSingle();

  if (memberError || !memberData) {
    return null;
  }

  // Then fetch the user's roles in this league
  const { data: roleData, error: roleError } = await supabase
    .from('assignedrolesforleague')
    .select('roles(role_name)')
    .eq('user_id', userId)
    .eq('league_id', leagueId);

  if (roleError) {
    return null;
  }

  // Get the first role (or highest priority role if multiple)
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

async function ensureChallengeInLeague(leagueId: string, challengeId: string) {
  const supabase = getSupabaseServiceRole();
  const { data, error } = await supabase
    .from('leagueschallenges')
    .select('id, league_id, status, challenge_type')
    .eq('id', challengeId)
    .maybeSingle();

  if (error || !data) return null;
  if (String(data.league_id) !== String(leagueId)) return null;
  return data;
}

// GET - Fetch submissions (host/governor get all, others get own) ----------
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

    const challenge = await ensureChallengeInLeague(leagueId, challengeId);
    if (!challenge) {
      return buildError('Challenge not found in this league', 404);
    }

    // Get filter params from query string
    const { searchParams } = new URL(req.url);
    const teamId = searchParams.get('teamId');
    const subTeamId = searchParams.get('subTeamId');

    let baseQuery = supabase
      .from('challenge_submissions')
      .select(
        `
        id,
        league_member_id,
        team_id,
        sub_team_id,
        awarded_points,
        status,
        proof_url,
        created_at,
        reviewed_at,
        reviewed_by,
        leaguemembers(user_id, team_id, teams(team_name), users!leaguemembers_user_id_fkey(user_id, username, email))
      `
      )
      .eq('league_challenge_id', challengeId);

    // Host/Governor see all; others only their own
    if (!isHostOrGovernor(membership.role)) {
      baseQuery = baseQuery.eq('league_member_id', membership.leagueMemberId);
    }

    // Apply team filter if provided (only for team/sub_team challenges)
    if (teamId && (challenge.challenge_type === 'team' || challenge.challenge_type === 'sub_team')) {
      baseQuery = baseQuery.eq('team_id', teamId);
    }

    // Apply sub-team filter if provided (only for sub_team challenges)
    if (subTeamId && challenge.challenge_type === 'sub_team') {
      baseQuery = baseQuery.eq('sub_team_id', subTeamId);
    }

    // For team challenges, surface submissions grouped by team first
    if (challenge.challenge_type === 'team') {
      baseQuery = baseQuery.order('team_id', { ascending: true });
    }

    const query = baseQuery.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching challenge submissions', error);
      return buildError('Failed to fetch submissions', 500);
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (err) {
    console.error('Unexpected error in GET challenge submissions', err);
    return buildError('Internal server error', 500);
  }
}

// POST - Submit proof for a challenge (player) --------------------------------
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
    if (!membership) {
      return buildError('Not a member of this league', 403);
    }

    const challenge = await ensureChallengeInLeague(leagueId, challengeId);
    if (!challenge) {
      return buildError('Challenge not found in this league', 404);
    }

    if (challenge.status === 'closed') {
      return buildError('Challenge is closed', 400);
    }

    const body = await req.json();
    const { proofUrl } = body;

    if (!proofUrl) {
      return buildError('proofUrl is required', 400);
    }

    // Fetch challenge details to know challenge type and get member's team/subteam
    const { data: challengeData, error: challengeError } = await supabase
      .from('leagueschallenges')
      .select('id, challenge_type, league_id, end_date')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challengeData) {
      return buildError('Failed to fetch challenge details', 500);
    }

    // Strict cutoff: cannot submit after end_date
    if (challengeData.end_date) {
      const todayUtc = new Date().toISOString().slice(0, 10);
      const endDate = String(challengeData.end_date);
      if (todayUtc > endDate) {
        return buildError('Challenge has ended. Submissions are closed.', 400);
      }
    }

    // Fetch member's team info
    const { data: memberData, error: memberError } = await supabase
      .from('leaguemembers')
      .select('team_id')
      .eq('league_member_id', membership.leagueMemberId)
      .single();

    if (memberError) {
      console.error('Error fetching member team:', memberError);
      return buildError('Failed to fetch member team info', 500);
    }

    // For team challenges, verify the member's team belongs to this league
    let validTeamId: string | null = null;
    if (challengeData.challenge_type === 'team' && memberData?.team_id) {
      const { data: teamLeague } = await supabase
        .from('teamleagues')
        .select('team_id')
        .eq('team_id', memberData.team_id)
        .eq('league_id', challengeData.league_id)
        .maybeSingle();

      if (teamLeague) {
        validTeamId = memberData.team_id;
      }
    }

    if (challengeData.challenge_type === 'team' && !validTeamId) {
      return buildError('You must belong to a team in this league to submit for this challenge', 400);
    }

    // Build submission payload with team/subteam based on challenge type
    const submissionPayload: Record<string, any> = {
      league_challenge_id: challengeId,
      league_member_id: membership.leagueMemberId,
      proof_url: proofUrl,
      status: 'pending',
      // Points are awarded by host/governor during review
      awarded_points: null,
      team_id: null,
      sub_team_id: null,
    };

    // Set team_id for team challenges (only if verified via teamleagues)
    if (challengeData.challenge_type === 'team' && validTeamId) {
      submissionPayload.team_id = validTeamId;
    }

    // For sub_team challenges, find which sub-team the user belongs to
    if (challengeData.challenge_type === 'sub_team' && memberData?.team_id) {
      // First, set the team_id
      submissionPayload.team_id = memberData.team_id;

      // Then find the sub-team this member belongs to for this challenge
      const { data: memberSubteam } = await supabase
        .from('challenge_subteam_members')
        .select('subteam_id, challenge_subteams!inner(league_challenge_id)')
        .eq('league_member_id', membership.leagueMemberId)
        .eq('challenge_subteams.league_challenge_id', challengeId)
        .single();

      if (memberSubteam) {
        submissionPayload.sub_team_id = memberSubteam.subteam_id;
      }
    }

    const { data, error } = await supabase
      .from('challenge_submissions')
      .insert(submissionPayload)
      .select()
      .single();

    if (error) {
      // Handle unique constraint (one per member)
      if ((error as any).code === '23505') {
        return buildError('You already submitted for this challenge', 409);
      }
      console.error('Error submitting challenge proof', error);
      return buildError('Failed to submit challenge', 500);
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Unexpected error in POST challenge submission', err);
    return buildError('Internal server error', 500);
  }
}
