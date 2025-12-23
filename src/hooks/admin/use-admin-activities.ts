"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  AdminActivity,
  AdminActivityFilters,
  AdminActivityCreateInput,
  AdminActivityUpdateInput,
} from "@/types/admin";

interface UseAdminActivitiesReturn {
  activities: AdminActivity[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createActivity: (data: AdminActivityCreateInput) => Promise<AdminActivity | null>;
  updateActivity: (activityId: string, data: AdminActivityUpdateInput) => Promise<AdminActivity | null>;
  deleteActivity: (activityId: string) => Promise<boolean>;
}

export function useAdminActivities(filters?: AdminActivityFilters): UseAdminActivitiesReturn {
  const [activities, setActivities] = useState<AdminActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (filters?.search) params.set("search", filters.search);
      if (filters?.category_id) params.set("category_id", filters.category_id);

      const response = await fetch(`/api/admin/activities?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch activities");
      }

      setActivities(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setActivities([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters?.search, filters?.category_id]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const createActivity = async (data: AdminActivityCreateInput): Promise<AdminActivity | null> => {
    try {
      const response = await fetch("/api/admin/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create activity");
      }

      await fetchActivities();
      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create activity");
      return null;
    }
  };

  const updateActivity = async (
    activityId: string,
    data: AdminActivityUpdateInput
  ): Promise<AdminActivity | null> => {
    try {
      const response = await fetch(`/api/admin/activities/${activityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update activity");
      }

      await fetchActivities();
      return result.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update activity");
      return null;
    }
  };

  const deleteActivity = async (activityId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/admin/activities/${activityId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete activity");
      }

      await fetchActivities();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete activity");
      return false;
    }
  };

  return {
    activities,
    isLoading,
    error,
    refetch: fetchActivities,
    createActivity,
    updateActivity,
    deleteActivity,
  };
}
