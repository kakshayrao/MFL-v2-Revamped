/**
 * Hook for fetching league leaderboard data.
 * Provides team rankings, individual rankings, and statistics with date range filtering.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';

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
  // Optional normalized points (computed client-side when normalization is active)
  normalized_points?: number;
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

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface PendingTeamWindowRanking {
  rank: number;
  team_id: string;
  team_name: string;
  total_points: number;
  avg_rr: number;
  pointsByDate: Record<string, number>;
}

export interface PendingWindow {
  dates: string[];
  teams: PendingTeamWindowRanking[];
}

export interface LeagueInfo {
  league_id: string;
  league_name: string;
  start_date: string;
  end_date: string;
}

export interface LeaderboardData {
  teams: TeamRanking[];
  pendingWindow?: PendingWindow;
  subTeams: SubTeamRanking[];
  individuals: IndividualRanking[];
  challengeTeams: TeamRanking[];
  challengeIndividuals: IndividualRanking[];
  stats: LeaderboardStats;
  dateRange: DateRange;
  league: LeagueInfo;
  normalization?: {
    active: boolean;
    hasVariance: boolean;
    avgSize: number;
    minSize: number;
    maxSize: number;
  };
}

export interface UseLeagueLeaderboardOptions {
  startDate?: string;
  endDate?: string;
}

export interface UseLeagueLeaderboardReturn {
  data: LeaderboardData | null;
  rawTeams?: TeamRanking[];
  rawPendingWindow?: PendingWindow;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setDateRange: (startDate: string | null, endDate: string | null) => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useLeagueLeaderboard(
  leagueId: string | null,
  options?: UseLeagueLeaderboardOptions
): UseLeagueLeaderboardReturn {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRangeState] = useState<{
    startDate: string | null;
    endDate: string | null;
  }>({
    startDate: options?.startDate || null,
    endDate: options?.endDate || null,
  });
  const [rawTeams, setRawTeams] = useState<TeamRanking[] | undefined>(undefined);
  const [rawPendingWindow, setRawPendingWindow] = useState<PendingWindow | undefined>(undefined);

  const fetchLeaderboard = useCallback(async () => {
    if (!leagueId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Build URL with query params
      const params = new URLSearchParams();
      params.set('tzOffsetMinutes', String(new Date().getTimezoneOffset()));
      if (dateRange.startDate) {
        params.set('startDate', dateRange.startDate);
      }
      if (dateRange.endDate) {
        params.set('endDate', dateRange.endDate);
      }

      const url = `/api/leagues/${leagueId}/leaderboard${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to fetch leaderboard (${response.status})`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch leaderboard');
      }

      let data: LeaderboardData = result.data;
      // Snapshot raw data before normalization
      setRawTeams(Array.isArray(data?.teams) ? data.teams : undefined);
      setRawPendingWindow(data?.pendingWindow);

      // Fetch normalization flag and team size variance from teams endpoint
      const teamsResp = await fetch(`/api/leagues/${leagueId}/teams`);
      if (teamsResp.ok) {
        const teamsJson = await teamsResp.json();
        const normalizeActive = Boolean(
          teamsJson?.data?.league?.normalize_points_by_capacity ??
          teamsJson?.data?.league?.normalize_points_by_team_size
        );
        const variance = teamsJson?.data?.teamSizeVariance as { hasVariance: boolean; avgSize: number; minSize: number; maxSize: number } | undefined;
        const teamMemberMap: Record<string, number> = {};
        const apiTeams: Array<{ team_id: string; member_count?: number }> = teamsJson?.data?.teams || [];
        apiTeams.forEach(t => { teamMemberMap[t.team_id] = Number(t.member_count ?? 0); });

        // Compute normalized points when active and variance exists
        if (normalizeActive && variance?.hasVariance && variance.maxSize > 0 && Array.isArray(data?.teams)) {
          // Apply normalized points using: (raw_points / member_count) × max_team_size
          const normalizedTeams = data.teams.map((t) => {
            const memberCount = Math.max(1, t.member_count);
            const normalizedBase = Math.round(t.points * (variance.maxSize / memberCount));
            const displayTotal = normalizedBase + (t.challenge_bonus || 0);
            return {
              ...t,
              normalized_points: normalizedBase,
              total_points: displayTotal, // overwrite displayed total to normalized base + challenge bonus
            };
          });
          // Sort by normalized display total and reassign ranks
          normalizedTeams.sort((a, b) => b.total_points - a.total_points);
          const reRanked = normalizedTeams.map((t, idx) => ({ ...t, rank: idx + 1 }));

          // Normalize pending window (today/yesterday) pointsByDate using team member counts
          let normalizedPending = data.pendingWindow;
          if (data.pendingWindow && data.pendingWindow.dates?.length) {
            const dates = data.pendingWindow.dates;
            const todayKey = dates[0]; // pendingWindowEnd first in list
            const teamsPW = data.pendingWindow.teams.map((pw) => {
              const memberCount = Math.max(1, teamMemberMap[pw.team_id] ?? 0);
              const normalizedPointsByDate: Record<string, number> = {};
              Object.entries(pw.pointsByDate || {}).forEach(([k, v]) => {
                normalizedPointsByDate[k] = Math.round((v || 0) * (variance.maxSize / memberCount));
              });
              return {
                ...pw,
                pointsByDate: normalizedPointsByDate,
              };
            });
            // Rank by today's normalized points
            teamsPW.sort((a, b) => (b.pointsByDate?.[todayKey] ?? 0) - (a.pointsByDate?.[todayKey] ?? 0));
            normalizedPending = {
              dates,
              teams: teamsPW.map((t, idx) => ({ ...t, rank: idx + 1 })),
            };
          }

          data = {
            ...data,
            normalization: {
              active: true,
              hasVariance: true,
              avgSize: variance.avgSize,
              minSize: variance.minSize,
              maxSize: variance.maxSize,
            },
            teams: reRanked,
            pendingWindow: normalizedPending,
          };
        } else {
          data = {
            ...data,
            normalization: {
              active: false,
              hasVariance: Boolean(variance?.hasVariance),
              avgSize: Number(variance?.avgSize ?? 0),
              minSize: Number(variance?.minSize ?? 0),
              maxSize: Number(variance?.maxSize ?? 0),
            },
          };
        }
      }

      setData(data);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, dateRange.startDate, dateRange.endDate]);

  // Set date range and trigger refetch
  const setDateRange = useCallback((startDate: string | null, endDate: string | null) => {
    setDateRangeState({ startDate, endDate });
  }, []);

  // Initial fetch and refetch on date range change
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return {
    data,
    rawTeams,
    rawPendingWindow,
    isLoading,
    error,
    refetch: fetchLeaderboard,
    setDateRange,
  };
}

export default useLeagueLeaderboard;
