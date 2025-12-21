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
    .select('id, league_id, status')
    .eq('id', challengeId)
    .maybeSingle();

  if (error || !data) return null;
  if (String(data.league_id) !== String(leagueId)) return null;
  return data;
}

// GET - Fetch submissions (host/governor get all, others get own) ----------
export async function GET(
  _req: NextRequest,
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

    const baseQuery = supabase
      .from('challenge_submissions')
      .select(
        `
        *,
        leaguemembers!inner(
          user_id,
          teams(team_name),
          users!leaguemembers_user_id_fkey(username)
        )
      `
      )
      .eq('league_challenge_id', challengeId)
      .order('created_at', { ascending: false });

    // Host/Governor see all; others only their own
    const query = isHostOrGovernor(membership.role)
      ? baseQuery
      : baseQuery.eq('league_member_id', membership.leagueMemberId);

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
    const { proofUrl, awardedPoints } = body;

    if (!proofUrl) {
      return buildError('proofUrl is required', 400);
    }

    // Fetch challenge details to know challenge type and get member's team/subteam
    const { data: challengeData, error: challengeError } = await supabase
      .from('leagueschallenges')
      .select('id, challenge_type, league_id')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challengeData) {
      return buildError('Failed to fetch challenge details', 500);
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

    // Build submission payload with team/subteam based on challenge type
    const submissionPayload: Record<string, any> = {
      league_challenge_id: challengeId,
      league_member_id: membership.leagueMemberId,
      proof_url: proofUrl,
      status: 'pending',
      awarded_points: awardedPoints ?? null,
      team_id: null,
      sub_team_id: null,
    };

    // Set team_id for team challenges (only if verified via teamleagues)
    if (challengeData.challenge_type === 'team' && validTeamId) {
      submissionPayload.team_id = validTeamId;
    }
    // For sub_team challenges, we'd need additional logic to find the user's subteam
    // This would be set by the client or determined by captain assignment
    // For now, leave as null and handle in review process

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
