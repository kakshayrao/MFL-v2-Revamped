"use client";

import { useState, useEffect, useCallback } from "react";

// ============================================================================
// Types
// ============================================================================

export interface TeamWithDetails {
  team_id: string;
  team_name: string;
  league_id: string;
  invite_code: string | null;
  member_count: number;
  captain: {
    user_id: string;
    username: string;
  } | null;
  created_by: string | null;
  created_date: string;
}

export interface LeagueMember {
  league_member_id: string;
  user_id: string;
  team_id: string | null;
  league_id: string;
  username: string;
  email: string;
  roles: string[];
  team_name?: string | null;
}

export interface TeamMember {
  league_member_id: string;
  user_id: string;
  team_id: string | null;
  league_id: string;
  username: string;
  email: string;
  is_captain: boolean;
  roles: string[];
}

export interface Governor {
  user_id: string;
  username: string;
}

export interface LeagueTeamsData {
  teams: TeamWithDetails[];
  members: {
    allocated: LeagueMember[];
    unallocated: LeagueMember[];
  };
  governors: Governor[];
  league: {
    league_id: string;
    league_name: string;
    num_teams: number;
    team_size: number;
    status: string;
    host_user_id: string;
  };
  meta: {
    current_team_count: number;
    max_teams: number;
    can_create_more: boolean;
  };
}

interface UseLeagueTeamsReturn {
  data: LeagueTeamsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTeam: (teamName: string) => Promise<boolean>;
  deleteTeam: (teamId: string) => Promise<boolean>;
  assignMember: (teamId: string, leagueMemberId: string) => Promise<boolean>;
  removeMember: (teamId: string, leagueMemberId: string) => Promise<boolean>;
  assignCaptain: (teamId: string, userId: string) => Promise<boolean>;
  removeCaptain: (teamId: string) => Promise<boolean>;
  assignGovernor: (userId: string) => Promise<boolean>;
  removeGovernor: (userId: string) => Promise<boolean>;
}

// ============================================================================
// Hook
// ============================================================================

export function useLeagueTeams(leagueId: string | null): UseLeagueTeamsReturn {
  const [data, setData] = useState<LeagueTeamsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTeams = useCallback(async () => {
    if (!leagueId) {
      setData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/leagues/${leagueId}/teams`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch teams");
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const createTeam = async (teamName: string): Promise<boolean> => {
    if (!leagueId) return false;

    try {
      const response = await fetch(`/api/leagues/${leagueId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team_name: teamName }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create team");
      }

      await fetchTeams();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
      return false;
    }
  };

  const deleteTeam = async (teamId: string): Promise<boolean> => {
    if (!leagueId) return false;

    try {
      const response = await fetch(`/api/leagues/${leagueId}/teams/${teamId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete team");
      }

      await fetchTeams();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete team");
      return false;
    }
  };

  const assignMember = async (
    teamId: string,
    leagueMemberId: string
  ): Promise<boolean> => {
    if (!leagueId) return false;

    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/teams/${teamId}/members`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ league_member_id: leagueMemberId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to assign member");
      }

      await fetchTeams();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign member");
      return false;
    }
  };

  const removeMember = async (
    teamId: string,
    leagueMemberId: string
  ): Promise<boolean> => {
    if (!leagueId) return false;

    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/teams/${teamId}/members`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ league_member_id: leagueMemberId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to remove member");
      }

      await fetchTeams();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
      return false;
    }
  };

  const assignCaptain = async (
    teamId: string,
    userId: string
  ): Promise<boolean> => {
    if (!leagueId) return false;

    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/teams/${teamId}/captain`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to assign captain");
      }

      await fetchTeams();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign captain");
      return false;
    }
  };

  const removeCaptain = async (teamId: string): Promise<boolean> => {
    if (!leagueId) return false;

    try {
      const response = await fetch(
        `/api/leagues/${leagueId}/teams/${teamId}/captain`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to remove captain");
      }

      await fetchTeams();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove captain");
      return false;
    }
  };

  const assignGovernor = async (userId: string): Promise<boolean> => {
    if (!leagueId) return false;

    try {
      const response = await fetch(`/api/leagues/${leagueId}/governor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to assign governor");
      }

      await fetchTeams();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign governor");
      return false;
    }
  };

  const removeGovernor = async (userId: string): Promise<boolean> => {
    if (!leagueId) return false;

    try {
      const response = await fetch(`/api/leagues/${leagueId}/governor`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to remove governor");
      }

      await fetchTeams();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove governor");
      return false;
    }
  };

  return {
    data,
    isLoading,
    error,
    refetch: fetchTeams,
    createTeam,
    deleteTeam,
    assignMember,
    removeMember,
    assignCaptain,
    removeCaptain,
    assignGovernor,
    removeGovernor,
  };
}

export default useLeagueTeams;
