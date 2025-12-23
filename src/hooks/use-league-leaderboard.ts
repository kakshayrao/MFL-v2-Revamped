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

export interface LeagueInfo {
  league_id: string;
  league_name: string;
  start_date: string;
  end_date: string;
}

export interface LeaderboardData {
  teams: TeamRanking[];
  subTeams: SubTeamRanking[];
  individuals: IndividualRanking[];
  challengeTeams: TeamRanking[];
  challengeIndividuals: IndividualRanking[];
  stats: LeaderboardStats;
  dateRange: DateRange;
  league: LeagueInfo;
}

export interface UseLeagueLeaderboardOptions {
  startDate?: string;
  endDate?: string;
}

export interface UseLeagueLeaderboardReturn {
  data: LeaderboardData | null;
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

      setData(result.data);
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
    isLoading,
    error,
    refetch: fetchLeaderboard,
    setDateRange,
  };
}

export default useLeagueLeaderboard;
