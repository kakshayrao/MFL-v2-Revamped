/**
 * GET /api/leagues/[id]/leaderboard - Get league leaderboard data
 *
 * Returns team rankings and individual rankings for a league.
 * Supports date range filtering for custom periods.
 * Includes special challenge bonuses in team scores.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth/config';
import { getSupabaseServiceRole } from '@/lib/supabase/client';

// ============================================================================
// Types
// ============================================================================

export interface TeamRanking {
  rank: number;
  team_id: string;
  team_name: string;
  points: number;
  challenge_bonus: number;
  total_points: number;
  avg_rr: number;
  member_count: number;
  submission_count: number;
}

export interface IndividualRanking {
  rank: number;
  user_id: string;
  username: string;
  team_id: string | null;
  team_name: string | null;
  points: number;
  avg_rr: number;
  submission_count: number;
}

export interface SubTeamRanking {
  rank: number;
  subteam_id: string;
  subteam_name: string;
  team_id: string | null;
  team_name: string | null;
  points: number;
  submission_count: number;
}

export interface LeaderboardStats {
  total_submissions: number;
  approved: number;
  pending: number;
  rejected: number;
  total_rr: number;
}

// ============================================================================
// GET Handler
// ============================================================================

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

    const supabase = getSupabaseServiceRole();

    // Get query params for date range filtering
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Verify league exists and get its date range
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('league_id, league_name, start_date, end_date')
      .eq('league_id', leagueId)
      .single();

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    // Only use date filtering if BOTH startDate and endDate are explicitly provided
    // Otherwise use league's start and end dates for the overall view
    const hasDateFilter = startDate && endDate;
    const filterStartDate = startDate || league.start_date;
    const filterEndDate = endDate || league.end_date;

    // =========================================================================
    // Get all teams in the league via teamleagues
    // =========================================================================
    const { data: teams, error: teamsError } = await supabase
      .from('teamleagues')
      .select(`
        team_id,
        teams(team_id, team_name)
      `)
      .eq('league_id', leagueId);

    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
      return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
    }

    // Create a set of valid team IDs for this league (for validation)
    const validTeamIds = new Set((teams || []).map((t) => t.team_id as string));

    // =========================================================================
    // Get all league members with team assignment
    // =========================================================================
    const { data: members, error: membersError } = await supabase
      .from('leaguemembers')
      .select(`
        league_member_id,
        user_id,
        team_id,
        users!leaguemembers_user_id_fkey(user_id, username)
      `)
      .eq('league_id', leagueId);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // Create member lookup maps
    const memberIds = (members || []).map((m) => m.league_member_id);
    const memberToUser = new Map<string, { user_id: string; username: string; team_id: string | null }>();
    const teamMembers = new Map<string, string[]>(); // team_id -> league_member_ids

    (members || []).forEach((m) => {
      const user = m.users as any;
      memberToUser.set(m.league_member_id, {
        user_id: m.user_id,
        username: user?.username || 'Unknown',
        team_id: m.team_id,
      });

      if (m.team_id) {
        const existing = teamMembers.get(m.team_id) || [];
        existing.push(m.league_member_id);
        teamMembers.set(m.team_id, existing);
      }
    });

    // =========================================================================
    // Get all effort entries within date range
    // =========================================================================
    let entriesQuery = supabase
      .from('effortentry')
      .select('id, league_member_id, date, type, rr_value, status')
      .in('league_member_id', memberIds);

    // Only apply date filtering if the user explicitly provided dates
    if (hasDateFilter) {
      if (startDate) {
        entriesQuery = entriesQuery.gte('date', startDate);
      }
      if (endDate) {
        entriesQuery = entriesQuery.lte('date', endDate);
      }
    }

    const { data: entries, error: entriesError } = await entriesQuery;

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }

    // =========================================================================
    // Get league challenge submissions with points
    // =========================================================================
    const { data: challengeSubmissions, error: challengeSubmissionsError } = await supabase
      .from('challenge_submissions')
      .select(`
        id,
        league_member_id,
        league_challenge_id,
        team_id,
        sub_team_id,
        status,
        created_at,
        awarded_points,
        leagueschallenges(
          id,
          name,
          total_points,
          challenge_type,
          start_date,
          end_date,
          league_id
        )
      `)
      .eq('status', 'approved');

    // Filter to only this league's challenges
    const leagueSubmissions = (challengeSubmissions || []).filter((sub) => {
      const challenge = (sub.leagueschallenges as any);
      return challenge && challenge.league_id === leagueId;
    });

    if (challengeSubmissionsError) {
      console.error('Error fetching challenge submissions:', challengeSubmissionsError);
      // Continue without challenge points
    }

    // Calculate challenge points by team, sub-team, and individual within date range
    const teamChallengePoints = new Map<string, number>();
    const memberChallengePoints = new Map<string, number>();
    const subTeamChallengePoints = new Map<string, number>();
    const subTeamSubmissionCounts = new Map<string, number>();

    (leagueSubmissions || []).forEach((sub) => {
      const challenge = (sub.leagueschallenges as any);
      if (!challenge) return;

      // Check if challenge is within date range (only if user provided dates)
      if (hasDateFilter) {
        const challengeDate = challenge.end_date || challenge.start_date || new Date().toISOString().split('T')[0];
        if (challengeDate < filterStartDate || challengeDate > filterEndDate) {
          console.debug(`Skipping challenge ${challenge.id} - date ${challengeDate} outside range ${filterStartDate} to ${filterEndDate}`);
          return;
        }
      }

      // Use awarded_points when present; otherwise fall back to the challenge's total_points.
      // Avoid `||` here because it can treat legitimate 0 values as falsy and incorrectly
      // fall back to the max points.
      const points =
        sub.awarded_points !== null && sub.awarded_points !== undefined
          ? Number(sub.awarded_points)
          : Number(challenge.total_points) || 0;
      if (points <= 0) {
        console.debug(`[Leaderboard] Skipping challenge submission ${sub.id} - no points (awarded: ${sub.awarded_points}, total: ${challenge.total_points})`);
        return;
      }
      console.debug(`[Leaderboard] Including challenge submission ${sub.id} with ${points} points for member ${sub.league_member_id}`);
      

      // Only individual challenges contribute to the individual leaderboard.
      // Team/sub_team challenges contribute to team totals, not to the submitting member.
      if (challenge.challenge_type === 'individual') {
        const memberKey = sub.league_member_id as string;
        const current = memberChallengePoints.get(memberKey) || 0;
        memberChallengePoints.set(memberKey, current + points);
      }

      // Handle team aggregation based on challenge type
      // All challenges (individual, team, sub_team) contribute to team scores
      if (challenge.challenge_type === 'team' && sub.team_id) {
        // Team challenge: use team_id from submission if it belongs to this league
        const teamKey = sub.team_id as string;
        if (validTeamIds.has(teamKey)) {
          const teamCurrent = teamChallengePoints.get(teamKey) || 0;
          teamChallengePoints.set(teamKey, teamCurrent + points);
        }
      } else if (challenge.challenge_type === 'sub_team' && sub.sub_team_id) {
        // Sub-team challenges: points show on sub-team leaderboard AND roll up to team leaderboard.
        const subTeamKey = sub.sub_team_id as string;
        const subTeamCurrent = subTeamChallengePoints.get(subTeamKey) || 0;
        subTeamChallengePoints.set(subTeamKey, subTeamCurrent + points);
        const subTeamCount = subTeamSubmissionCounts.get(subTeamKey) || 0;
        subTeamSubmissionCounts.set(subTeamKey, subTeamCount + 1);

        // Sub-team challenge: sub_team_id submissions should be aggregated to their parent team
        // We need to lookup which team this sub_team belongs to
        // Since sub_team members are league members, and league members have team_id, 
        // we aggregate through the submitter's team membership
        const memberInfo = memberToUser.get(sub.league_member_id as string);
        if (memberInfo?.team_id && validTeamIds.has(memberInfo.team_id)) {
          const teamKey = memberInfo.team_id;
          const teamCurrent = teamChallengePoints.get(teamKey) || 0;
          teamChallengePoints.set(teamKey, teamCurrent + points);
        }
      } else if (challenge.challenge_type === 'individual') {
        // Individual challenges: Points count for the individual AND their team
        // Aggregate individual challenge points to team through member's team membership
        const memberInfo = memberToUser.get(sub.league_member_id as string);
        if (memberInfo?.team_id && validTeamIds.has(memberInfo.team_id)) {
          const teamKey = memberInfo.team_id;
          const teamCurrent = teamChallengePoints.get(teamKey) || 0;
          teamChallengePoints.set(teamKey, teamCurrent + points);
        }
      }
    });

    // =========================================================================
    // Get special challenge bonuses for teams (legacy)
    // =========================================================================
    let challengesQuery = supabase
      .from('specialchallengeteamscore')
      .select(`
        team_id,
        score,
        specialchallenges(challenge_id, name)
      `)
      .eq('league_id', leagueId);

    const { data: challengeScores, error: challengeError } = await challengesQuery;

    if (challengeError) {
      console.error('Error fetching challenge scores:', challengeError);
      // Continue without challenge bonuses
    }

    // Aggregate bonus scores (date filtering removed: specialchallenges no longer has end_date)
    const specialChallengeBonus = new Map<string, number>();
    (challengeScores || []).forEach((cs) => {
      const challenge = cs.specialchallenges as any;
      if (!challenge) return;
      const existing = specialChallengeBonus.get(cs.team_id) || 0;
      specialChallengeBonus.set(cs.team_id, existing + (cs.score || 0));
    });

    // =========================================================================
    // Calculate statistics
    // =========================================================================
    const stats: LeaderboardStats = {
      total_submissions: (entries || []).length,
      approved: (entries || []).filter((e) => e.status === 'approved').length,
      pending: (entries || []).filter((e) => e.status === 'pending').length,
      rejected: (entries || []).filter((e) => e.status === 'rejected').length,
      total_rr: (entries || [])
        .filter((e) => e.status === 'approved' && e.rr_value)
        .reduce((sum, e) => sum + (e.rr_value || 0), 0),
    };

    // =========================================================================
    // Calculate team rankings
    // =========================================================================
    const teamStats = new Map<string, {
      team_id: string;
      team_name: string;
      points: number;
      total_rr: number;
      rr_count: number;
      member_count: number;
      submission_count: number;
    }>();

    // Initialize team stats
    (teams || []).forEach((t) => {
      const team = t.teams as any;
      if (team) {
        const memberList = teamMembers.get(team.team_id) || [];
        teamStats.set(team.team_id, {
          team_id: team.team_id,
          team_name: team.team_name,
          points: 0,
          total_rr: 0,
          rr_count: 0,
          member_count: memberList.length,
          submission_count: 0,
        });
      }
    });

    // Aggregate entries by team
    (entries || []).forEach((entry) => {
      const memberInfo = memberToUser.get(entry.league_member_id);
      if (!memberInfo?.team_id) return;

      const teamStat = teamStats.get(memberInfo.team_id);
      if (!teamStat) return;

      teamStat.submission_count++;

      // Only approved entries count toward points
      if (entry.status === 'approved') {
        // 1 point per approved entry (per PRD)
        teamStat.points++;

        // Track RR values for average calculation
        if (entry.rr_value && entry.rr_value > 0) {
          teamStat.total_rr += entry.rr_value;
          teamStat.rr_count++;
        }
      }
    });

    // Convert to array and add challenge bonuses
    const teamRankings: TeamRanking[] = Array.from(teamStats.values())
      .map((ts) => {
        const legacyBonus = specialChallengeBonus.get(ts.team_id) || 0;
        const challengePoints = teamChallengePoints.get(ts.team_id) || 0;
        const totalChallengeBonus = legacyBonus + challengePoints;
        return {
          rank: 0, // Will be set after sorting
          team_id: ts.team_id,
          team_name: ts.team_name,
          points: ts.points,
          challenge_bonus: totalChallengeBonus,
          total_points: ts.points + totalChallengeBonus,
          avg_rr: ts.rr_count > 0 ? Math.round((ts.total_rr / ts.rr_count) * 100) / 100 : 0,
          member_count: ts.member_count,
          submission_count: ts.submission_count,
        };
      })
      .sort((a, b) => {
        // Sort by total_points DESC, then avg_rr DESC
        if (b.total_points !== a.total_points) return b.total_points - a.total_points;
        return b.avg_rr - a.avg_rr;
      })
      .map((team, index) => ({ ...team, rank: index + 1 }));

    // =========================================================================
    // Calculate individual rankings
    // =========================================================================
    const individualStats = new Map<string, {
      user_id: string;
      username: string;
      team_id: string | null;
      team_name: string | null;
      points: number;
      total_rr: number;
      rr_count: number;
      submission_count: number;
    }>();

    // Initialize individual stats from members
    (members || []).forEach((m) => {
      const user = m.users as any;
      const team = (teams || []).find((t) => (t.teams as any)?.team_id === m.team_id);
      const teamInfo = team?.teams as any;

      individualStats.set(m.league_member_id, {
        user_id: m.user_id,
        username: user?.username || 'Unknown',
        team_id: m.team_id,
        team_name: teamInfo?.team_name || null,
        points: 0,
        total_rr: 0,
        rr_count: 0,
        submission_count: 0,
      });
    });

    // Aggregate entries by individual
    (entries || []).forEach((entry) => {
      const individualStat = individualStats.get(entry.league_member_id);
      if (!individualStat) return;

      individualStat.submission_count++;

      if (entry.status === 'approved') {
        individualStat.points++;

        if (entry.rr_value && entry.rr_value > 0) {
          individualStat.total_rr += entry.rr_value;
          individualStat.rr_count++;
        }
      }
    });

    // Add challenge points to individuals
    (Array.from(memberChallengePoints.entries()) || []).forEach(([memberId, challengePoints]) => {
      const individualStat = individualStats.get(memberId);
      if (individualStat) {
        individualStat.points += challengePoints;
      }
    });

    // Convert to array and sort
    const fullParam = searchParams.get('full') === 'true';

    let individualRankings: IndividualRanking[] = Array.from(individualStats.values())
      .map((is) => ({
        rank: 0,
        user_id: is.user_id,
        username: is.username,
        team_id: is.team_id,
        team_name: is.team_name,
        points: is.points,
        avg_rr: is.rr_count > 0 ? Math.round((is.total_rr / is.rr_count) * 100) / 100 : 0,
        submission_count: is.submission_count,
      }))
      .sort((a, b) => {
        // Sort by points DESC, then avg_rr DESC
        if (b.points !== a.points) return b.points - a.points;
        return b.avg_rr - a.avg_rr;
      })
      .map((individual, index) => ({ ...individual, rank: index + 1 }));

    // By default, limit to top 50 unless client asks for full=true
    if (!fullParam) {
      individualRankings = individualRankings.slice(0, 50);
    }

    // =========================================================================
    // Calculate sub-team rankings (challenge points only)
    // =========================================================================
    let subTeamRankings: SubTeamRanking[] = [];
    const subTeamIds = Array.from(subTeamChallengePoints.keys());

    if (subTeamIds.length > 0) {
      const { data: subTeams, error: subTeamsError } = await supabase
        .from('challenge_subteams')
        .select('subteam_id, name, team_id, teams(team_name)')
        .in('subteam_id', subTeamIds);

      if (subTeamsError) {
        console.error('Error fetching sub-teams:', subTeamsError);
      }

      const subTeamInfoMap = new Map(
        (subTeams || []).map((st: any) => [
          String(st.subteam_id),
          {
            subteam_name: st.name as string,
            team_id: (st.team_id as string | null) ?? null,
            team_name: (st.teams?.team_name as string | null) ?? null,
          },
        ])
      );

      subTeamRankings = subTeamIds
        .map((subteam_id) => {
          const info = subTeamInfoMap.get(String(subteam_id));
          return {
            rank: 0,
            subteam_id: String(subteam_id),
            subteam_name: info?.subteam_name || 'Unknown Sub-team',
            team_id: info?.team_id ?? null,
            team_name: info?.team_name ?? null,
            points: subTeamChallengePoints.get(subteam_id) || 0,
            submission_count: subTeamSubmissionCounts.get(subteam_id) || 0,
          };
        })
        .filter((st) => st.points > 0)
        .sort((a, b) => b.points - a.points)
        .map((st, index) => ({ ...st, rank: index + 1 }));
    }

    // =========================================================================
    // Calculate challenge-only leaderboards
    // =========================================================================
    const challengeTeamRankings: TeamRanking[] = Array.from(teamStats.values())
      .map((ts) => {
        const challengePoints = teamChallengePoints.get(ts.team_id) || 0;
        return {
          rank: 0,
          team_id: ts.team_id,
          team_name: ts.team_name,
          points: challengePoints,
          challenge_bonus: 0,
          total_points: challengePoints,
          avg_rr: 0,
          member_count: ts.member_count,
          submission_count: 0,
        };
      })
      .filter((t) => t.points > 0) // Only include teams with challenge points
      .sort((a, b) => b.total_points - a.total_points)
      .map((team, index) => ({ ...team, rank: index + 1 }));

    const challengeIndividualRankings: IndividualRanking[] = Array.from(individualStats.values())
      .map((is) => {
        const challengePoints = memberChallengePoints.get(is.user_id) || 0;
        return {
          rank: 0,
          user_id: is.user_id,
          username: is.username,
          team_id: is.team_id,
          team_name: is.team_name,
          points: challengePoints,
          avg_rr: 0,
          submission_count: 0,
        };
      })
      .filter((i) => i.points > 0) // Only include individuals with challenge points
      .sort((a, b) => b.points - a.points)
      .map((individual, index) => ({ ...individual, rank: index + 1 }))
      .slice(0, 50);

    // =========================================================================
    // Return response
    // =========================================================================
    return NextResponse.json({
      success: true,
      data: {
        teams: teamRankings,
        subTeams: subTeamRankings,
        individuals: individualRankings,
        challengeTeams: challengeTeamRankings,
        challengeIndividuals: challengeIndividualRankings,
        stats,
        dateRange: {
          startDate: filterStartDate,
          endDate: filterEndDate,
        },
        league: {
          league_id: league.league_id,
          league_name: league.league_name,
          start_date: league.start_date,
          end_date: league.end_date,
        },
      },
    });
  } catch (error) {
    console.error('Error in leaderboard GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
