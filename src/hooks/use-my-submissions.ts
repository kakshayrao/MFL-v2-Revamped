/**
 * Hook for fetching and managing the current user's submissions in a league.
 * Provides data fetching, filtering, and state management for the My Submissions view.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface MySubmission {
  id: string;
  date: string;
  type: 'workout' | 'rest';
  workout_type: string | null;
  duration: number | null;
  distance: number | null;
  steps: number | null;
  holes: number | null;
  rr_value: number | null;
  status: 'pending' | 'approved' | 'rejected';
  proof_url: string | null;
  notes: string | null;
  created_date: string;
  modified_date: string;
  reupload_of: string | null;
  rejection_reason: string | null;
}

/**
 * Check if a submission is an exemption request
 */
export function isExemptionRequest(submission: MySubmission): boolean {
  return submission.type === 'rest' &&
         submission.notes?.includes('[EXEMPTION_REQUEST]') || false;
}

export interface SubmissionStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface MySubmissionsData {
  submissions: MySubmission[];
  stats: SubmissionStats;
  leagueMemberId: string;
  teamId: string | null;
}

export interface UseMySubmissionsReturn {
  data: MySubmissionsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useMySubmissions(leagueId: string | null): UseMySubmissionsReturn {
  const [data, setData] = useState<MySubmissionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!leagueId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/leagues/${leagueId}/my-submissions`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch submissions (${response.status})`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch submissions');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching my submissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  // Initial fetch
  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchSubmissions,
  };
}

export default useMySubmissions;
