/**
 * Hook for fetching and managing activities configured for a league.
 * Provides data fetching and state management for the Submit Activity page.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface LeagueActivity {
  activity_id: string;
  activity_name: string;
  description: string | null;
  category_id: string | null;
  category?: {
    category_id: string;
    category_name: string;
    display_name: string;
  } | null;
  value: string; // Normalized name for workout_type
}

export interface LeagueActivitiesData {
  activities: LeagueActivity[];
  allActivities?: LeagueActivity[]; // All available activities (for host configuration)
  isLeagueSpecific: boolean;
  isHost?: boolean;
}

export interface UseLeagueActivitiesReturn {
  data: LeagueActivitiesData | null;
  isLoading: boolean;
  error: string | null;
  errorCode: string | null; // For specific error handling (e.g., 'NO_ACTIVITIES_CONFIGURED')
  refetch: () => Promise<void>;
  addActivities: (activityIds: string[]) => Promise<boolean>;
  removeActivity: (activityId: string) => Promise<boolean>;
}

// ============================================================================
// Hook
// ============================================================================

export function useLeagueActivities(
  leagueId: string | null,
  options?: { includeAll?: boolean }
): UseLeagueActivitiesReturn {
  const [data, setData] = useState<LeagueActivitiesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const includeAll = options?.includeAll ?? false;

  const fetchActivities = useCallback(async () => {
    if (!leagueId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setErrorCode(null);

      const url = includeAll
        ? `/api/leagues/${leagueId}/activities?includeAll=true`
        : `/api/leagues/${leagueId}/activities`;
      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to fetch activities (${response.status})`);
      }

      // Check for specific error code (e.g., NO_ACTIVITIES_CONFIGURED)
      if (!result.success && result.error) {
        setErrorCode(result.error);
        setError(result.message || result.error);
        setData(result.data || { activities: [], isLeagueSpecific: false });
        return;
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching league activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, includeAll]);

  // Add activities to league (host only)
  const addActivities = useCallback(async (activityIds: string[]): Promise<boolean> => {
    if (!leagueId) return false;

    try {
      const response = await fetch(`/api/leagues/${leagueId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_ids: activityIds }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add activities');
      }

      // Refetch activities after adding
      await fetchActivities();
      return true;
    } catch (err) {
      console.error('Error adding activities:', err);
      setError(err instanceof Error ? err.message : 'Failed to add activities');
      return false;
    }
  }, [leagueId, fetchActivities]);

  // Remove activity from league (host only)
  const removeActivity = useCallback(async (activityId: string): Promise<boolean> => {
    if (!leagueId) return false;

    try {
      const response = await fetch(`/api/leagues/${leagueId}/activities`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: activityId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove activity');
      }

      // Refetch activities after removing
      await fetchActivities();
      return true;
    } catch (err) {
      console.error('Error removing activity:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove activity');
      return false;
    }
  }, [leagueId, fetchActivities]);

  // Initial fetch
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return {
    data,
    isLoading,
    error,
    errorCode,
    refetch: fetchActivities,
    addActivities,
    removeActivity,
  };
}

export default useLeagueActivities;
