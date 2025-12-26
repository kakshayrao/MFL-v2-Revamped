'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useSession } from 'next-auth/react';

// ============================================================================
// Types
// ============================================================================

export type LeagueRole = 'host' | 'governor' | 'captain' | 'player';
export type LeagueStatus = 'draft' | 'launched' | 'active' | 'completed';

export interface LeagueWithRoles {
  league_id: string;
  name: string;
  description: string | null;
  status: LeagueStatus;
  start_date: string | null;
  end_date: string | null;
  num_teams: number;
  team_capacity: number;
  is_public: boolean;
  is_exclusive: boolean;
  invite_code: string | null;
  roles: LeagueRole[];
  team_id: string | null;
  team_name: string | null;
  is_host: boolean;
}

interface LeagueContextType {
  // League state
  activeLeague: LeagueWithRoles | null;
  userLeagues: LeagueWithRoles[];
  setActiveLeague: (league: LeagueWithRoles | null) => void;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;

  // Role switching
  currentRole: LeagueRole | null;
  setCurrentRole: (role: LeagueRole) => void;
  availableRoles: LeagueRole[];

  /**
   * Whether the user is participating as a player in the current role context.
   * - Always true for 'player' and 'captain' roles (captain is always a player)
   * - For 'host' and 'governor', true if they also have 'player' role
   */
  isAlsoPlayer: boolean;

  /**
   * Get the highest permission role for the user in the active league
   */
  highestRole: LeagueRole | null;
}

// ============================================================================
// Context
// ============================================================================

const LeagueContext = createContext<LeagueContextType | undefined>(undefined);

// ============================================================================
// Role Hierarchy
// ============================================================================

const ROLE_HIERARCHY: LeagueRole[] = ['host', 'governor', 'captain', 'player'];

/**
 * Get the highest permission role from a list of roles
 */
function getHighestRole(roles: LeagueRole[]): LeagueRole | null {
  for (const role of ROLE_HIERARCHY) {
    if (roles.includes(role)) {
      return role;
    }
  }
  return null;
}

/**
 * Sort roles by hierarchy (highest first)
 */
function sortRolesByHierarchy(roles: LeagueRole[]): LeagueRole[] {
  return [...roles].sort((a, b) => {
    return ROLE_HIERARCHY.indexOf(a) - ROLE_HIERARCHY.indexOf(b);
  });
}

// ============================================================================
// Provider
// ============================================================================

interface LeagueProviderProps {
  children: ReactNode;
}

/**
 * LeagueProvider - Manages the user's leagues, active league, and role switching.
 *
 * Features:
 * - Fetches all leagues the user belongs to with their roles
 * - Persists active league selection in localStorage
 * - Supports role switching within a league
 * - Tracks whether user is participating as a player
 */
export function LeagueProvider({ children }: LeagueProviderProps) {
  const { data: session, status: sessionStatus } = useSession();
  const [activeLeague, setActiveLeagueState] = useState<LeagueWithRoles | null>(null);
  const [userLeagues, setUserLeagues] = useState<LeagueWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentRole, setCurrentRoleState] = useState<LeagueRole | null>(null);

  // Fetch user's leagues with roles
  const fetchUserLeagues = useCallback(async () => {
    if (!session?.user?.id) {
      setIsLoading(false);
      setUserLeagues([]);
      setActiveLeagueState(null);
      setCurrentRoleState(null);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/user/leagues');

      if (!response.ok) {
        // Don't throw on auth errors - user might not be fully logged in yet
        if (response.status === 401) {
          setUserLeagues([]);
          setActiveLeagueState(null);
          setCurrentRoleState(null);
          return;
        }
        console.error('Failed to fetch leagues:', response.status);
        return;
      }

      const data = await response.json();
      const leagues: LeagueWithRoles[] = data.leagues || [];

      setUserLeagues(leagues);

      // Restore active league from localStorage or default to first
      const savedLeagueId = localStorage.getItem('activeLeagueId');
      let selectedLeague: LeagueWithRoles | null = null;

      if (savedLeagueId) {
        selectedLeague = leagues.find(l => l.league_id === savedLeagueId) || null;
      }

      if (!selectedLeague && leagues.length > 0) {
        selectedLeague = leagues[0];
      }

      if (selectedLeague) {
        setActiveLeagueState(selectedLeague);
        localStorage.setItem('activeLeagueId', selectedLeague.league_id);

        // Restore or set default role
        const savedRole = localStorage.getItem(`role_${selectedLeague.league_id}`);
        const sortedRoles = sortRolesByHierarchy(selectedLeague.roles);

        if (savedRole && selectedLeague.roles.includes(savedRole as LeagueRole)) {
          setCurrentRoleState(savedRole as LeagueRole);
        } else if (sortedRoles.length > 0) {
          // Default to highest role
          setCurrentRoleState(sortedRoles[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch user leagues:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leagues');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Fetch on mount and session change
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    fetchUserLeagues();
  }, [sessionStatus, fetchUserLeagues]);

  // Set active league with persistence
  const setActiveLeague = useCallback((league: LeagueWithRoles | null) => {
    setActiveLeagueState(league);

    if (league) {
      localStorage.setItem('activeLeagueId', league.league_id);

      // Restore or set default role for the new league
      const savedRole = localStorage.getItem(`role_${league.league_id}`);
      const sortedRoles = sortRolesByHierarchy(league.roles);

      if (savedRole && league.roles.includes(savedRole as LeagueRole)) {
        setCurrentRoleState(savedRole as LeagueRole);
      } else if (sortedRoles.length > 0) {
        setCurrentRoleState(sortedRoles[0]);
      } else {
        setCurrentRoleState(null);
      }
    } else {
      localStorage.removeItem('activeLeagueId');
      setCurrentRoleState(null);
    }
  }, []);

  // Set current role with persistence
  const setCurrentRole = useCallback((role: LeagueRole) => {
    if (!activeLeague) return;

    // Validate role is available
    if (!activeLeague.roles.includes(role)) {
      console.warn(`Role ${role} is not available for user in league ${activeLeague.league_id}`);
      return;
    }

    setCurrentRoleState(role);
    localStorage.setItem(`role_${activeLeague.league_id}`, role);
  }, [activeLeague]);

  // Computed values
  const availableRoles = useMemo(() => {
    if (!activeLeague) return [];
    return sortRolesByHierarchy(activeLeague.roles);
  }, [activeLeague]);

  const highestRole = useMemo(() => {
    if (!activeLeague) return null;
    return getHighestRole(activeLeague.roles);
  }, [activeLeague]);

  /**
   * Determine if the user is participating as a player in the current context
   *
   * Rules per PRD:
   * - Captain is ALWAYS a player (implicit)
   * - Player role is always a player
   * - Host/Governor are only players if they have the 'player' role explicitly
   */
  const isAlsoPlayer = useMemo(() => {
    if (!activeLeague || !currentRole) return false;

    // Player role - always true
    if (currentRole === 'player') return true;

    // Captain is always a player (per PRD: "All Captains are automatically Players")
    if (currentRole === 'captain') return true;

    // Host/Governor - check if they also have player role
    if (currentRole === 'host' || currentRole === 'governor') {
      return activeLeague.roles.includes('player');
    }

    return false;
  }, [activeLeague, currentRole]);

  return (
    <LeagueContext.Provider
      value={{
        activeLeague,
        userLeagues,
        setActiveLeague,
        isLoading,
        error,
        refetch: fetchUserLeagues,
        currentRole,
        setCurrentRole,
        availableRoles,
        isAlsoPlayer,
        highestRole,
      }}
    >
      {children}
    </LeagueContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

export function useLeague() {
  const context = useContext(LeagueContext);
  if (context === undefined) {
    throw new Error('useLeague must be used within a LeagueProvider');
  }
  return context;
}

export default LeagueProvider;
