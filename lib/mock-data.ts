/**
 * @fileoverview Data normalization utilities for API compatibility
 * 
 * This module provides types and functions to normalize data between:
 * - API responses (snake_case from Supabase)
 * - UI components (camelCase for React conventions)
 * 
 * The normalizer functions handle both directions, allowing components
 * to work with either format transparently.
 * 
 * @module lib/mock-data
 */

// ============================================================
// NORMALIZED TYPES - Bridge API and UI conventions
// ============================================================

/**
 * Valid candidate stages matching the database schema
 * Alias for CandidateStage from types/index.ts
 */
export type CandidateStatus = 
  | "applied" 
  | "screening"
  | "ai_interview"
  | "phone_screen"
  | "technical"
  | "onsite"
  | "offer" 
  | "hired" 
  | "rejected"

/**
 * Status of background question pre-generation for a candidate
 * Questions are pre-generated after scoring to enable instant interview scheduling
 */
export type QuestionGenerationStatus = "none" | "pending" | "generating" | "ready" | "failed"

/**
 * Normalized Candidate type with both snake_case and camelCase fields
 * 
 * This interface includes both naming conventions to support:
 * - Direct API response usage (snake_case)
 * - Frontend component conventions (camelCase)
 * 
 * Use normalizeCandidate() to convert raw API data to this format.
 */
export interface Candidate {
  id: string
  /** camelCase: display name */
  name: string
  /** snake_case: database field */
  full_name?: string
  email: string
  /** camelCase: avatar URL */
  avatar?: string
  /** snake_case: GitHub profile picture URL */
  avatar_url?: string
  /** camelCase: AI match score (0-100) */
  aiScore: number
  /** snake_case: database field */
  ai_score?: number
  /** camelCase: formatted experience string (e.g., "5 years") */
  experience: string
  years_of_experience?: number
  skills: string[]
  extracted_skills?: string[]
  /** camelCase: pipeline stage */
  status: CandidateStatus
  /** snake_case: database field */
  stage?: CandidateStatus
  /** camelCase: ISO date string of application */
  appliedAt: string
  /** snake_case: database field */
  applied_at?: string
  /** camelCase: associated job ID */
  jobId: string
  /** snake_case: database field */
  job_id?: string
  summary?: string
  ai_summary?: string
  strengths?: string[]
  ai_strengths?: string[]
  concerns?: string[]
  ai_concerns?: string[]
  linkedIn?: string
  linkedin_url?: string
  github?: string
  github_url?: string
  portfolio?: string
  portfolio_url?: string
  is_starred?: boolean
  /** camelCase: question pre-generation status */
  questionGenerationStatus?: QuestionGenerationStatus
  /** snake_case: database field */
  question_generation_status?: QuestionGenerationStatus
}

/**
 * Input type for normalizeCandidate
 * Accepts any object shape to handle both API (null) and frontend (undefined) values
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CandidateInput = Record<string, any>

/**
 * Input type for normalizeJob
 * Accepts any object shape to handle both API (null) and frontend (undefined) values
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JobInput = Record<string, any>

/**
 * Partial record of stage counts for pipeline progress calculation
 * Used to show how many candidates are at each stage
 */
export type StageCounts = Partial<Record<CandidateStatus, number>>

/**
 * Normalized Job type with both snake_case and camelCase fields
 * 
 * This interface includes both naming conventions to support:
 * - Direct API response usage (snake_case)
 * - Frontend component conventions (camelCase)
 * 
 * Use normalizeJob() to convert raw API data to this format.
 */
export interface Job {
  id: string
  title: string
  department: string | null
  level: string | null
  status: "active" | "draft" | "closed" | "paused"
  location: string | null
  location_type?: "remote" | "onsite" | "hybrid" | null
  /** camelCase: employment type */
  type: "full-time" | "part-time" | "contract" | "internship"
  /** snake_case: database field */
  employment_type?: "full-time" | "part-time" | "contract" | "internship"
  /** camelCase: total applicant count */
  applicants: number
  /** snake_case: database field */
  total_applicants?: number
  /** camelCase: number of high-scoring candidates */
  topMatches: number
  /** snake_case: database field */
  active_candidates?: number
  /** camelCase: archive status */
  isArchived: boolean
  /** snake_case: database field */
  is_archived?: boolean
  /** camelCase: ISO date string */
  createdAt: string
  /** snake_case: database field */
  created_at?: string
  description?: string
  /** camelCase: job requirements */
  requirements?: string[]
  /** snake_case: database field */
  required_skills?: string[]
  nice_to_have_skills?: string[]
  slug?: string
  /** camelCase: candidates per stage */
  stageCounts?: StageCounts
  /** snake_case: database field */
  stage_counts?: StageCounts
}

// ============================================================
// NORMALIZER FUNCTIONS - Convert between API and UI formats
// ============================================================

/**
 * Normalizes candidate data from API response to component format
 * 
 * Handles both snake_case (API) and camelCase (UI) field names,
 * providing both conventions in the output for maximum compatibility.
 * 
 * @param data - Raw candidate data from API or form
 * @returns Normalized Candidate with both naming conventions
 * 
 * @example
 * // From API response
 * const apiData = { full_name: "John Doe", ai_score: 85 };
 * const candidate = normalizeCandidate(apiData);
 * console.log(candidate.name); // "John Doe"
 * console.log(candidate.aiScore); // 85
 */
export function normalizeCandidate(data: CandidateInput): Candidate {
  return {
    id: data.id || "",
    name: data.name || data.full_name || "",
    full_name: data.full_name || data.name,
    email: data.email || "",
    avatar: data.avatar || data.avatar_url || undefined,
    avatar_url: data.avatar_url || data.avatar || undefined,
    aiScore: data.aiScore ?? data.ai_score ?? 0,
    ai_score: data.ai_score ?? data.aiScore,
    experience: data.experience || `${data.years_of_experience || 0} years`,
    years_of_experience: data.years_of_experience ?? undefined,
    skills: data.skills || data.extracted_skills || [],
    extracted_skills: data.extracted_skills || data.skills,
    status: data.status || data.stage || "applied",
    stage: data.stage || data.status,
    appliedAt: data.appliedAt || data.applied_at || new Date().toISOString(),
    applied_at: data.applied_at || data.appliedAt,
    jobId: data.jobId || data.job_id || "",
    job_id: data.job_id || data.jobId,
    summary: data.summary || data.ai_summary || undefined,
    ai_summary: data.ai_summary || data.summary || undefined,
    strengths: data.strengths || data.ai_strengths || undefined,
    ai_strengths: data.ai_strengths || data.strengths || undefined,
    concerns: data.concerns || data.ai_concerns || undefined,
    ai_concerns: data.ai_concerns || data.concerns || undefined,
    linkedIn: data.linkedIn || data.linkedin_url || undefined,
    linkedin_url: data.linkedin_url || data.linkedIn || undefined,
    github: data.github || data.github_url || undefined,
    github_url: data.github_url || data.github || undefined,
    portfolio: data.portfolio || data.portfolio_url || undefined,
    portfolio_url: data.portfolio_url || data.portfolio || undefined,
    is_starred: data.is_starred ?? undefined,
    questionGenerationStatus: data.questionGenerationStatus || data.question_generation_status || "none",
    question_generation_status: data.question_generation_status || data.questionGenerationStatus || "none",
  }
}

/**
 * Normalizes job data from API response to component format
 * 
 * Handles both snake_case (API) and camelCase (UI) field names,
 * providing both conventions in the output for maximum compatibility.
 * 
 * @param data - Raw job data from API or form
 * @returns Normalized Job with both naming conventions
 * 
 * @example
 * // From API response
 * const apiData = { total_applicants: 25, is_archived: false };
 * const job = normalizeJob(apiData);
 * console.log(job.applicants); // 25
 * console.log(job.isArchived); // false
 */
export function normalizeJob(data: JobInput): Job {
  return {
    id: data.id || "",
    title: data.title || "",
    department: data.department || null,
    level: data.level || null,
    status: data.status || "draft",
    location: data.location || null,
    location_type: data.location_type ?? undefined,
    type: data.type || data.employment_type || "full-time",
    employment_type: data.employment_type || data.type || undefined,
    applicants: data.applicants ?? data.total_applicants ?? 0,
    total_applicants: data.total_applicants ?? data.applicants ?? undefined,
    topMatches: data.topMatches ?? data.active_candidates ?? 0,
    active_candidates: data.active_candidates ?? data.topMatches ?? undefined,
    isArchived: data.isArchived ?? data.is_archived ?? false,
    is_archived: data.is_archived ?? data.isArchived ?? undefined,
    createdAt: data.createdAt || data.created_at || new Date().toISOString(),
    created_at: data.created_at || data.createdAt || undefined,
    description: data.description ?? undefined,
    requirements: data.requirements || data.required_skills || undefined,
    required_skills: data.required_skills || data.requirements || undefined,
    nice_to_have_skills: data.nice_to_have_skills ?? undefined,
    slug: data.slug ?? undefined,
    stageCounts: data.stageCounts || data.stage_counts || undefined,
    stage_counts: data.stage_counts || data.stageCounts || undefined,
  }
}
