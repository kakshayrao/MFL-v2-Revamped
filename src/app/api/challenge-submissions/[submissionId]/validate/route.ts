import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';
import { syncSpecialChallengeScores } from '@/lib/services/challenges/special-challenge-score';

type LeagueRole = 'host' | 'governor' | 'captain' | 'player' | null;

function buildError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function getMembership(userId: string, leagueId: string) {
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
  return (roleNames[0] as LeagueRole) ?? null;
}

function isHostOrGovernor(role: LeagueRole) {
  return role === 'host' || role === 'governor';
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return buildError('Unauthorized', 401);
    }

    const { submissionId } = await params;
    const supabase = getSupabaseServiceRole();

    // Fetch submission with league + challenge context
    const { data: submission, error: fetchError } = await supabase
      .from('challenge_submissions')
      .select(
        `
        id,
        league_member_id,
        team_id,
        league_challenge_id,
        status,
        awarded_points,
        leagueschallenges(league_id, challenge_id, challenge_type, total_points),
        leaguemembers(team_id)
      `
      )
      .eq('id', submissionId)
      .maybeSingle();

    if (fetchError || !submission) {
      return buildError('Submission not found', 404);
    }

    const leagueChallenge = (submission as any).leagueschallenges;
    const leagueId = leagueChallenge?.league_id;
    if (!leagueId) {
      return buildError('Submission missing league context', 400);
    }

    console.log(`[Challenge Validation] Processing submission ${submissionId}:`, {
      leagueId,
      challengeType: leagueChallenge?.challenge_type,
      totalPoints: leagueChallenge?.total_points,
      currentAwardedPoints: (submission as any).awarded_points
    });

    const role = await getMembership(session.user.id, String(leagueId));
    if (!role || !isHostOrGovernor(role)) {
      return buildError('Forbidden', 403);
    }

    const body = await req.json();
    const { status, awardedPoints } = body as { status: 'approved' | 'rejected'; awardedPoints?: number };

    if (!status || (status !== 'approved' && status !== 'rejected')) {
      return buildError('status must be approved or rejected', 400);
    }

    const challenge = leagueChallenge as any;

    const maxPointsRaw = challenge?.total_points;
    const maxPoints =
      maxPointsRaw !== undefined && maxPointsRaw !== null && Number.isFinite(Number(maxPointsRaw))
        ? Number(maxPointsRaw)
        : null;

    const updatePayload: Record<string, any> = {
      status,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
    };

    if (status === 'approved') {
      // Priority: explicit awardedPoints > challenge.total_points
      let resolvedPoints: number | null = null;
      
      if (awardedPoints !== undefined && awardedPoints !== null) {
        const pts = Number(awardedPoints);
        if (!Number.isFinite(pts)) {
          return buildError('Invalid awardedPoints value', 400);
        }
        if (pts < 0) {
          return buildError('awardedPoints must be >= 0', 400);
        }
        if (maxPoints !== null && pts > maxPoints) {
          return buildError('awardedPoints cannot exceed challenge total points', 400);
        }
        resolvedPoints = pts;
      } else if (challenge?.total_points !== undefined && challenge.total_points !== null) {
        resolvedPoints = Number(challenge.total_points);
      }

      // Validate the resolved points is a finite number
      const finalPoints = Number.isFinite(resolvedPoints) && resolvedPoints! > 0
        ? resolvedPoints
        : null;

      if (!finalPoints) {
        console.warn(`[Challenge Validation] No valid points assigned for submission ${submissionId}. awardedPoints: ${awardedPoints}, challenge.total_points: ${challenge?.total_points}, resolved: ${resolvedPoints}`);
      } else {
        console.log(`[Challenge Validation] Assigning ${finalPoints} points to submission ${submissionId}`);
      }

      updatePayload.awarded_points = finalPoints;

      // Ensure team_id is recorded for team challenges
      if (challenge?.challenge_type === 'team') {
        const memberTeam = (submission as any).leaguemembers?.team_id;
        if (memberTeam && !(submission as any).team_id) {
          updatePayload.team_id = memberTeam;
        }
      }
    } else {
      // Clear points when rejecting
      updatePayload.awarded_points = null;
    }

    const { data, error: updateError } = await supabase
      .from('challenge_submissions')
      .update(updatePayload)
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating challenge submission', updateError);
      return buildError('Failed to update submission', 500);
    }

    // Sync legacy special challenge score tables for downstream consumers
    console.log(`[Challenge Validation] Syncing scores for submission ${submissionId}, status: ${status}, points: ${updatePayload.awarded_points}`);
    await syncSpecialChallengeScores({
      leagueChallengeId: (submission as any).league_challenge_id,
      challengeId: challenge?.challenge_id,
      leagueId: leagueId as string,
      challengeType: challenge?.challenge_type,
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Unexpected error validating challenge submission', err);
    return buildError('Internal server error', 500);
  }
}
