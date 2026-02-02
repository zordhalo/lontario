/**
 * @fileoverview React Query hooks for job management
 * 
 * This module provides client-side hooks for all job operations:
 * - List jobs with filtering and pagination
 * - Get individual job details
 * - Create, update, delete jobs
 * - Publish, pause, close jobs
 * - Archive/unarchive jobs
 * 
 * Uses React Query for caching and optimistic updates.
 * 
 * @module hooks/use-jobs
 */

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Job, ListJobsQuery, ListJobsResponse, CreateJobRequest } from "@/types";

// ============================================================
// QUERY KEYS - For cache management
// ============================================================

/**
 * Query key factory for job queries
 * Provides consistent keys for cache invalidation
 */
export const jobKeys = {
  all: ["jobs"] as const,
  lists: () => [...jobKeys.all, "list"] as const,
  list: (filters: ListJobsQuery) => [...jobKeys.lists(), filters] as const,
  details: () => [...jobKeys.all, "detail"] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
};

// API functions
async function fetchJobs(filters: ListJobsQuery = {}): Promise<ListJobsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  });

  const response = await fetch(`/api/jobs?${params}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch jobs");
  }
  return response.json();
}

async function fetchJob(id: string): Promise<Job & { candidate_summary: unknown }> {
  const response = await fetch(`/api/jobs/${id}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch job");
  }
  return response.json();
}

async function createJob(data: CreateJobRequest): Promise<Job> {
  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create job");
  }
  return response.json();
}

async function updateJob(id: string, data: Partial<Job>): Promise<Job> {
  const response = await fetch(`/api/jobs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update job");
  }
  return response.json();
}

async function deleteJob(id: string): Promise<void> {
  const response = await fetch(`/api/jobs/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete job");
  }
}

// ============================================================
// REACT QUERY HOOKS
// ============================================================

/**
 * Hook for fetching a paginated list of jobs
 * 
 * @param filters - Optional query filters (status, include_archived, sort)
 * @returns Query result with jobs and pagination
 * 
 * @example
 * const { data, isLoading } = useJobs({ status: "active" });
 */
export function useJobs(filters: ListJobsQuery = {}) {
  return useQuery({
    queryKey: jobKeys.list(filters),
    queryFn: () => fetchJobs(filters),
    staleTime: 60_000, // Consider data stale after 1 minute
  });
}

/**
 * Hook for fetching a single job with candidate summary
 * 
 * @param id - Job UUID
 * @returns Query result with job details
 */
export function useJob(id: string) {
  return useQuery({
    queryKey: jobKeys.detail(id),
    queryFn: () => fetchJob(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Hook for creating a new job
 * Sets the new job in cache on success
 * 
 * @returns Mutation for job creation
 */
export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createJob,
    onSuccess: (newJob) => {
      // Invalidate job lists
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
      // Optionally set the new job in cache
      queryClient.setQueryData(jobKeys.detail(newJob.id), newJob);
    },
  });
}

/**
 * Hook for updating job fields
 * Uses optimistic updates for immediate feedback
 * 
 * @returns Mutation with optimistic update support
 */
export function useUpdateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Job> }) =>
      updateJob(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: jobKeys.detail(id) });

      // Snapshot previous value
      const previousJob = queryClient.getQueryData(jobKeys.detail(id));

      // Optimistically update
      queryClient.setQueryData(jobKeys.detail(id), (old: Job | undefined) =>
        old ? { ...old, ...data } : old
      );

      return { previousJob };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousJob) {
        queryClient.setQueryData(jobKeys.detail(id), context.previousJob);
      }
    },
    onSettled: (data, error, { id }) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

/**
 * Hook for deleting a job
 * Removes from cache on success
 * 
 * @returns Mutation for job deletion
 */
export function useDeleteJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteJob,
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: jobKeys.detail(id) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

/**
 * Hook for publishing a draft job (sets status to "active")
 * 
 * @returns Mutation for publishing
 */
export function usePublishJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => updateJob(id, { status: "active" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

/**
 * Hook for closing a job (sets status to "closed")
 * Closed jobs no longer accept applications
 * 
 * @returns Mutation for closing
 */
export function useCloseJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => updateJob(id, { status: "closed" }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

/**
 * Hook for archiving a job
 * Archived jobs are hidden from default views
 * 
 * @returns Mutation for archiving
 */
export function useArchiveJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => updateJob(id, { is_archived: true }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}

/**
 * Hook for unarchiving a job
 * Restores job to normal visibility
 * 
 * @returns Mutation for unarchiving
 */
export function useUnarchiveJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => updateJob(id, { is_archived: false }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: jobKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: jobKeys.lists() });
    },
  });
}
