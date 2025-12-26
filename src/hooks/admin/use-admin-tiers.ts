"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase/client";
import type {
  AdminTier,
  AdminTierCreateInput,
  AdminTierUpdateInput,
} from "@/types/admin";

interface UseAdminTiersReturn {
  tiers: AdminTier[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createTier: (data: AdminTierCreateInput) => Promise<AdminTier | null>;
  updateTier: (tierId: string, data: AdminTierUpdateInput) => Promise<AdminTier | null>;
  deleteTier: (tierId: string) => Promise<boolean>;
}

export function useAdminTiers(): UseAdminTiersReturn {
  const [tiers, setTiers] = useState<AdminTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTiers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/tiers");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch tiers");
      }

      setTiers(result.tiers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setTiers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  const createTier = async (data: AdminTierCreateInput): Promise<AdminTier | null> => {
    try {
      const response = await fetch("/api/admin/tiers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create tier");
      }

      await fetchTiers();
      return result.tier as AdminTier;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tier");
      return null;
    }
  };

  const updateTier = async (
    tierId: string,
    data: AdminTierUpdateInput
  ): Promise<AdminTier | null> => {
    try {
      const response = await fetch(`/api/admin/tiers/${tierId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update tier");
      }

      await fetchTiers();
      return (result.tier || result.data || null) as AdminTier | null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update tier");
      return null;
    }
  };

  const deleteTier = async (tierId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/admin/tiers/${tierId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete tier");
      }

      await fetchTiers();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tier");
      return false;
    }
  };

  return {
    tiers,
    isLoading,
    error,
    refetch: fetchTiers,
    createTier,
    updateTier,
    deleteTier,
  };
}
