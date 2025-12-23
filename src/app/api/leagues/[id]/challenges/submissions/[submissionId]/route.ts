/**
 * PATCH /api/leagues/[id]/challenges/submissions/[submissionId]
 * Review and approve/reject challenge submission
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';
import { syncSpecialChallengeScores } from '@/lib/services/challenges/special-challenge-score';

type LeagueRole = 'host' | 'governor' | 'captain' | 'player' | null;

function buildError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function getMembership(userId: string, leagueId: string): Promise<{ leagueMemberId: string; role: LeagueRole } | null> {
  const supabase = getSupabaseServiceRole();

  const { data: memberData } = await supabase
    .from('leaguemembers')
    .select('league_member_id')
    .eq('user_id', userId)
    .eq('league_id', leagueId)
    .maybeSingle();

  if (!memberData) return null;

  const { data: roleData } = await supabase
    .from('assignedrolesforleague')
    .select('roles(role_name)')
    .eq('user_id', userId)
    .eq('league_id', leagueId);

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const session = (await getServerSession(authOptions as any)) as import('next-auth').Session | null;
    if (!session?.user?.id) {
      return buildError('Unauthorized', 401);
    }

    const { id: leagueId, submissionId } = await params;
    const supabase = getSupabaseServiceRole();

    const membership = await getMembership(session.user.id, leagueId);
    if (!membership || !isHostOrGovernor(membership.role)) {
      return buildError('Only hosts/governors can review submissions', 403);
    }

    const body = await req.json();
    const { status, awardedPoints } = body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return buildError('Invalid status. Must be "approved" or "rejected"', 400);
    }

    // Fetch submission with challenge details
    const { data: submission, error: subError } = await supabase
      .from('challenge_submissions')
      .select(`
        id,
        league_challenge_id,
        league_member_id,
        team_id,
        leaguemembers(
          team_id
        ),
        leagueschallenges(
          league_id,
          challenge_type,
          total_points,
          challenge_id
        )
      `)
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      return buildError('Submission not found', 404);
    }

    // Verify submission belongs to this league
    const challengeLeague = (submission.leagueschallenges as any)?.league_id;
    const submissionChallenge = (submission.leagueschallenges as any);
    if (String(challengeLeague) !== String(leagueId)) {
      return buildError('Submission not in this league', 403);
    }

    // Prepare update payload
    const updatePayload: Record<string, any> = {
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: session.user.id,
    };

    // When approving, set awarded_points (allow custom awardedPoints with validation)
    if (status === 'approved') {
      if (awardedPoints !== undefined) {
        const pts = Number(awardedPoints);
        if (!Number.isFinite(pts)) {
          return buildError('Invalid awardedPoints value', 400);
        }
        if (pts < 0) {
          return buildError('awardedPoints must be >= 0', 400);
        }
        if (
          submissionChallenge?.total_points !== undefined &&
          submissionChallenge?.total_points !== null &&
          Number.isFinite(Number(submissionChallenge.total_points)) &&
          pts > Number(submissionChallenge.total_points)
        ) {
          return buildError('awardedPoints cannot exceed challenge total points', 400);
        }
        updatePayload.awarded_points = pts;
      } else if (
        submissionChallenge?.total_points !== undefined &&
        submissionChallenge?.total_points !== null &&
        Number.isFinite(Number(submissionChallenge.total_points))
      ) {
        updatePayload.awarded_points = Number(submissionChallenge.total_points);
      } else {
        updatePayload.awarded_points = null;
      }
    } else {
      updatePayload.awarded_points = null;
    }

    // For team challenges, ensure team_id is set based on member's team
    if (submissionChallenge?.challenge_type === 'team') {
      const memberInfo = (submission.leaguemembers as any);
      if (memberInfo?.team_id && !submission.team_id) {
        updatePayload.team_id = memberInfo.team_id;
      }
    }

    // Update submission
    const { data, error } = await supabase
      .from('challenge_submissions')
      .update(updatePayload)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating challenge submission:', error);
      return buildError('Failed to update submission', 500);
    }

      await syncSpecialChallengeScores({
        leagueChallengeId: submission.league_challenge_id,
        challengeId: submissionChallenge?.challenge_id,
        leagueId: submissionChallenge?.league_id,
        challengeType: submissionChallenge?.challenge_type,
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('Unexpected error in PATCH challenge submission:', err);
    return buildError('Internal server error', 500);
  }
}
