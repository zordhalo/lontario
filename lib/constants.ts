/**
 * @fileoverview Application constants and configuration values
 * 
 * This module exports all static configuration values used throughout
 * the application, including:
 * - Pipeline stage definitions
 * - Job status and level options
 * - AI score thresholds
 * - Question category configurations
 * - API endpoint paths
 * 
 * All values are exported as const for type safety.
 * 
 * @module lib/constants
 */

// ============================================================
// PIPELINE STAGES - Hiring workflow configuration
// ============================================================

/**
 * Full pipeline stage configuration with descriptions
 * Used for detailed pipeline views and configuration screens
 */
export const PIPELINE_STAGES = [
  { id: "applied", label: "Applied", color: "bg-gray-500", description: "New applications" },
  { id: "screening", label: "Screening", color: "bg-blue-500", description: "AI screening in progress" },
  { id: "ai_interview", label: "AI Interview", color: "bg-purple-500", description: "Text-based AI interview" },
  { id: "phone_screen", label: "Phone Screen", color: "bg-indigo-500", description: "Human phone screen" },
  { id: "technical", label: "Technical", color: "bg-cyan-500", description: "Technical interview" },
  { id: "onsite", label: "Onsite", color: "bg-teal-500", description: "Onsite/final round" },
  { id: "offer", label: "Offer", color: "bg-amber-500", description: "Offer extended" },
  { id: "hired", label: "Hired", color: "bg-green-500", description: "Accepted offer" },
] as const;

/**
 * Simplified pipeline stages for Kanban board display
 * Matches database CandidateStage enum values
 */
export const KANBAN_STAGES = [
  { id: "applied", label: "Applied", color: "bg-gray-500" },
  { id: "screening", label: "Screening", color: "bg-blue-500" },
  { id: "ai_interview", label: "AI Interview", color: "bg-purple-500" },
  { id: "phone_screen", label: "Phone Screen", color: "bg-indigo-500" },
  { id: "technical", label: "Technical", color: "bg-cyan-500" },
  { id: "onsite", label: "Onsite", color: "bg-teal-500" },
  { id: "offer", label: "Offer", color: "bg-amber-500" },
  { id: "hired", label: "Hired", color: "bg-green-500" },
] as const;

// ============================================================
// JOB CONFIGURATION - Status, levels, and types
// ============================================================

/**
 * Job status display configuration
 * Maps status values to labels and Tailwind CSS classes
 */
export const JOB_STATUS = {
  draft: { label: "Draft", color: "bg-warning/10 text-warning border-warning/30" },
  active: { label: "Active", color: "bg-success/10 text-success border-success/30" },
  paused: { label: "Paused", color: "bg-orange-100 text-orange-800 border-orange-200" },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground border-border" },
} as const;

/**
 * Job seniority levels for dropdown selects
 */
export const JOB_LEVELS = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "staff", label: "Staff" },
  { value: "principal", label: "Principal" },
] as const;

/**
 * Employment type options for dropdown selects
 */
export const EMPLOYMENT_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
] as const;

/**
 * Work location arrangement options
 */
export const LOCATION_TYPES = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "On-site" },
  { value: "hybrid", label: "Hybrid" },
] as const;

// ============================================================
// AI CONFIGURATION - Scoring and evaluation
// ============================================================

/**
 * AI score threshold values for categorizing candidates
 * Used to color-code and filter candidates by match quality
 * 
 * @example
 * const quality = score >= AI_SCORE_THRESHOLDS.excellent ? 'excellent' :
 *                 score >= AI_SCORE_THRESHOLDS.good ? 'good' :
 *                 score >= AI_SCORE_THRESHOLDS.moderate ? 'moderate' : 'low';
 */
export const AI_SCORE_THRESHOLDS = {
  /** Score >= 90: Exceptional match */
  excellent: 90,
  /** Score >= 70: Strong match */
  good: 70,
  /** Score >= 50: Moderate match */
  moderate: 50,
} as const;

/**
 * Question category configuration with display colors
 * Used in question lists and interview views
 */
export const QUESTION_CATEGORIES = [
  { value: "technical", label: "Technical", color: "bg-blue-100 text-blue-800" },
  { value: "behavioral", label: "Behavioral", color: "bg-green-100 text-green-800" },
  { value: "system-design", label: "System Design", color: "bg-purple-100 text-purple-800" },
  { value: "problem-solving", label: "Problem Solving", color: "bg-orange-100 text-orange-800" },
  { value: "culture-fit", label: "Culture Fit", color: "bg-pink-100 text-pink-800" },
] as const;

/**
 * AI recommendation display configuration
 * Maps recommendation values to labels, colors, and icons
 */
export const RECOMMENDATIONS = {
  strong_yes: { label: "Strong Yes", color: "bg-green-100 text-green-800", icon: "👍👍" },
  yes: { label: "Yes", color: "bg-green-50 text-green-700", icon: "👍" },
  maybe: { label: "Maybe", color: "bg-yellow-100 text-yellow-800", icon: "🤔" },
  no: { label: "No", color: "bg-red-50 text-red-700", icon: "👎" },
  strong_no: { label: "Strong No", color: "bg-red-100 text-red-800", icon: "👎👎" },
} as const;

// ============================================================
// API CONFIGURATION - Endpoint paths
// ============================================================

/**
 * API endpoint path constants
 * Centralized definition for all REST API routes
 * 
 * @example
 * fetch(`${API_ENDPOINTS.candidates}/${candidateId}`)
 * fetch(API_ENDPOINTS.ai.generateQuestions, { method: 'POST', ... })
 */
export const API_ENDPOINTS = {
  jobs: "/api/jobs",
  candidates: "/api/candidates",
  interviews: "/api/interviews",
  ai: {
    generateQuestions: "/api/ai/generate-questions",
    scoreCandidate: "/api/ai/score-candidate",
    parseResume: "/api/ai/parse-resume",
    evaluateAnswer: "/api/ai/evaluate-answer",
    followUp: "/api/ai/follow-up",
    scrapeProfile: "/api/ai/scrape-profile",
  },
} as const;

// ============================================================
// ENVIRONMENT FLAGS
// ============================================================

/**
 * Demo mode flag - true when Supabase is not configured
 * Used to show mock data and disable database operations
 */
export const IS_DEMO_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL;
