"use client";

import { useQuery } from "@tanstack/react-query";

// Types
export interface Activity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  candidateId: string;
  candidateName: string | null;
  metadata: unknown;
}

export interface ListActivitiesQuery {
  limit?: number;
  job_id?: string;
}

export interface ListActivitiesResponse {
  activities: Activity[];
}

// Query keys
export const activityKeys = {
  all: ["activities"] as const,
  lists: () => [...activityKeys.all, "list"] as const,
  list: (filters: ListActivitiesQuery) => [...activityKeys.lists(), filters] as const,
};

// API function
async function fetchActivities(
  filters: ListActivitiesQuery = {}
): Promise<ListActivitiesResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });

  const response = await fetch(`/api/activities?${params}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch activities");
  }
  return response.json();
}

// Hook
export function useActivities(filters: ListActivitiesQuery = {}) {
  return useQuery({
    queryKey: activityKeys.list(filters),
    queryFn: () => fetchActivities(filters),
    staleTime: 30_000, // Consider data stale after 30 seconds
    refetchInterval: 60_000, // Refetch every minute for live updates
  });
}
