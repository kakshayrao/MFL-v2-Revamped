/**
 * GET /api/leagues/[id]/challenges/[challengeId]/leaderboard
 * Returns rankings for a specific challenge based on its type
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

function buildError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

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

    // Verify user is a member of the league
    const { data: membership } = await supabase
      .from('leaguemembers')
      .select('league_member_id')
      .eq('user_id', session.user.id)
      .eq('league_id', leagueId)
      .maybeSingle();

    if (!membership) {
      return buildError('Not a member of this league', 403);
    }

    // Fetch challenge details
    const { data: challenge, error: challengeError } = await supabase
      .from('leagueschallenges')
      .select('id, name, challenge_type, total_points, league_id')
      .eq('id', challengeId)
      .single();

    if (challengeError || !challenge) {
      return buildError('Challenge not found', 404);
    }

    if (challenge.league_id !== leagueId) {
      return buildError('Challenge does not belong to this league', 400);
    }

    // Fetch submissions for this challenge
    const { data: submissions, error: submissionsError } = await supabase
      .from('challenge_submissions')
      .select(`
        id,
        league_member_id,
        team_id,
        sub_team_id,
        awarded_points,
        leaguemembers!inner(
          user_id,
          team_id,
          users!leaguemembers_user_id_fkey(username)
        )
      `)
      .eq('league_challenge_id', challengeId)
      .eq('status', 'approved');

    if (submissionsError) {
      console.error('Error fetching submissions:', submissionsError);
      return buildError('Failed to fetch submissions', 500);
    }

    let rankings: Array<{ id: string; name: string; score: number; rank: number }> = [];

    if (challenge.challenge_type === 'individual') {
      // Individual challenge - group by league_member_id
      const memberScores = new Map<string, { name: string; score: number; userId: string }>();

      (submissions || []).forEach((sub: any) => {
        const memberId = sub.league_member_id;
        const points = Number(sub.awarded_points || 0);
        const username = sub.leaguemembers?.users?.username || 'Unknown';
        const userId = sub.leaguemembers?.user_id || memberId;

        const existing = memberScores.get(memberId) || { name: username, score: 0, userId };
        memberScores.set(memberId, {
          ...existing,
          score: existing.score + points,
        });
      });

      rankings = Array.from(memberScores.entries())
        .map(([id, data]) => ({
          id: data.userId,
          name: data.name,
          score: data.score,
          rank: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .map((item, index) => ({ ...item, rank: index + 1 }));

    } else if (challenge.challenge_type === 'team') {
      // Team challenge - group by team_id
      const teamScores = new Map<string, { name: string; score: number }>();

      // Fetch team names
      const teamIds = Array.from(new Set((submissions || []).map((s: any) => s.team_id).filter(Boolean)));
      const { data: teams } = await supabase
        .from('teams')
        .select('team_id, team_name')
        .in('team_id', teamIds);

      const teamNameMap = new Map((teams || []).map((t) => [t.team_id, t.team_name]));

      (submissions || []).forEach((sub: any) => {
        const teamId = sub.team_id || sub.leaguemembers?.team_id;
        if (!teamId) return;

        const points = Number(sub.awarded_points || 0);
        const teamName = teamNameMap.get(teamId) || 'Unknown Team';

        const existing = teamScores.get(teamId) || { name: teamName, score: 0 };
        teamScores.set(teamId, {
          ...existing,
          score: existing.score + points,
        });
      });

      rankings = Array.from(teamScores.entries())
        .map(([id, data]) => ({
          id,
          name: data.name,
          score: data.score,
          rank: 0,
        }))
        .sort((a, b) => b.score - a.score)
        .map((item, index) => ({ ...item, rank: index + 1 }));

    } else if (challenge.challenge_type === 'sub_team') {
      // Sub-team challenge - group by sub_team_id
      const subTeamScores = new Map<string, { name: string; score: number; teamName: string }>();

      // Fetch sub-team names with team info
      const subTeamIds = Array.from(new Set((submissions || []).map((s: any) => s.sub_team_id).filter(Boolean)));
      if (subTeamIds.length > 0) {
        const { data: subTeams } = await supabase
          .from('challenge_subteams')
          .select('subteam_id, name, team_id, teams(team_name)')
          .in('subteam_id', subTeamIds);

        const subTeamDataMap = new Map((subTeams || []).map((st: any) => [
          st.subteam_id,
          { name: st.name, teamName: st.teams?.team_name || 'Unknown Team' }
        ]));

        (submissions || []).forEach((sub: any) => {
          const subTeamId = sub.sub_team_id;
          if (!subTeamId) return;

          const points = Number(sub.awarded_points || 0);
          const subTeamData = subTeamDataMap.get(subTeamId) || { name: 'Unknown Sub-team', teamName: 'Unknown Team' };

          const existing = subTeamScores.get(subTeamId) || { name: subTeamData.name, score: 0, teamName: subTeamData.teamName };
          subTeamScores.set(subTeamId, {
            ...existing,
            score: existing.score + points,
          });
        });

        rankings = Array.from(subTeamScores.entries())
          .map(([id, data]) => ({
            id,
            name: data.name,
            score: data.score,
            teamName: data.teamName,
            rank: 0,
          }))
          .sort((a, b) => b.score - a.score)
          .map((item, index) => ({ ...item, rank: index + 1 }));
      }
    }

    return NextResponse.json({
      success: true,
      data: rankings,
    });
  } catch (err) {
    console.error('Unexpected error in challenge leaderboard:', err);
    return buildError('Internal server error', 500);
  }
}
