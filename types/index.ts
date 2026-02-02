/**
 * @fileoverview Type definitions for Lontario - AI Hiring Platform
 * 
 * This module contains all TypeScript types, interfaces, and Zod schemas used throughout
 * the application. Types are organized into the following categories:
 * 
 * - **Database Types**: Match the Supabase database schema (snake_case)
 * - **AI Types**: Types for AI-powered features (question generation, scoring)
 * - **API Types**: Request/response types for API endpoints
 * - **UI Types**: Types for frontend state management
 * 
 * @module types
 */

import { z } from "zod";

// ============================================================
// DATABASE TYPES (Matches Supabase schema)
// ============================================================

/**
 * Generic JSON type for flexible database fields
 * Used for storing arbitrary JSON data in Supabase JSONB columns
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================================
// ENUMS - Database-backed enumerated types
// ============================================================

/**
 * Candidate pipeline stages representing the hiring workflow
 * Candidates progress through these stages from application to hire
 * 
 * @example
 * // Moving a candidate through the pipeline
 * candidate.stage = "screening"; // Initial AI evaluation
 * candidate.stage = "ai_interview"; // Scheduled for AI interview
 */
export type CandidateStage =
  | "applied"        // New application received
  | "screening"      // AI screening in progress
  | "ai_interview"   // Text-based AI interview scheduled
  | "phone_screen"   // Human phone screen
  | "technical"      // Technical interview round
  | "onsite"         // Onsite/final interview round
  | "offer"          // Offer extended to candidate
  | "hired"          // Candidate accepted offer
  | "rejected";      // Candidate rejected at any stage

/**
 * Job posting lifecycle status
 */
export type JobStatus = 
  | "draft"   // Not published, still being edited
  | "active"  // Published and accepting applications
  | "paused"  // Temporarily not accepting applications
  | "closed"; // No longer accepting applications

/**
 * Seniority level for job positions
 */
export type JobLevel = "junior" | "mid" | "senior" | "staff" | "principal";

/**
 * Work location arrangement
 */
export type LocationType = "remote" | "onsite" | "hybrid";

/**
 * Employment type/contract type
 */
export type EmploymentType = "full-time" | "part-time" | "contract" | "internship";

/**
 * AI Interview lifecycle status
 * Tracks the interview from scheduling through completion
 */
export type InterviewStatus =
  | "pending"      // Questions being generated
  | "scheduled"    // Interview scheduled for future time
  | "ready"        // Questions ready, waiting to send
  | "sent"         // Invitation email sent to candidate
  | "in_progress"  // Candidate is actively taking the interview
  | "completed"    // All questions answered, evaluation complete
  | "expired"      // Interview link expired without completion
  | "abandoned"    // Candidate started but didn't finish
  | "missed"       // Candidate didn't start by scheduled time
  | "cancelled";   // Interview cancelled by recruiter

/**
 * AI-generated hiring recommendation based on interview performance
 */
export type InterviewRecommendation =
  | "strong_yes"  // Exceptional candidate, highly recommend
  | "yes"         // Good candidate, recommend proceeding
  | "maybe"       // Mixed signals, needs further evaluation
  | "no"          // Does not meet requirements
  | "strong_no";  // Significant concerns, do not proceed

/**
 * Categories for interview questions
 * Used to ensure balanced question coverage
 */
export type QuestionCategory =
  | "technical"        // Coding, algorithms, language-specific
  | "behavioral"       // Leadership, teamwork, past experiences
  | "system-design"    // Architecture, scalability, trade-offs
  | "problem-solving"  // Debugging, optimization challenges
  | "culture-fit";     // Values alignment, collaboration style

/**
 * Question difficulty levels for progressive interview structure
 */
export type QuestionDifficulty = "easy" | "medium" | "hard";

// ============================================================
// CORE ENTITY TYPES - Database table interfaces
// ============================================================

/**
 * User profile stored in Supabase
 * Linked to Supabase Auth user via id field
 * 
 * @property id - UUID matching Supabase Auth user ID
 * @property role - Access level determining permissions
 * @property notification_preferences - JSON blob of email/push settings
 */
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  role: "recruiter" | "admin" | "member";
  avatar_url: string | null;
  timezone: string;
  notification_preferences: Json;
  created_at: string;
  updated_at: string;
}

/**
 * Job posting entity
 * 
 * A job represents an open position that candidates can apply to.
 * Jobs have a lifecycle (draft → active → closed) and contain
 * requirements that are used for AI candidate matching.
 * 
 * @property created_by - Profile ID of the recruiter who created this job
 * @property required_skills - Skills used for AI matching and scoring
 * @property nice_to_have_skills - Bonus skills that improve candidate score
 * @property ai_generated_description - Whether description was AI-enhanced
 * @property screening_questions - Custom questions shown during application
 */
export interface Job {
  id: string;
  created_by: string;
  title: string;
  slug: string | null;
  level: JobLevel | null;
  department: string | null;
  location: string | null;
  location_type: LocationType | null;
  employment_type: EmploymentType | null;
  description: string;
  responsibilities: string[] | null;
  required_skills: string[];
  nice_to_have_skills: string[];
  ai_generated_description: boolean;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  show_salary: boolean;
  status: JobStatus;
  is_featured: boolean;
  application_deadline: string | null;
  screening_questions: Json;
  require_cover_letter: boolean;
  require_linkedin: boolean;
  require_github: boolean;
  /** Total number of candidates who applied */
  total_applicants: number;
  /** Candidates not yet rejected/hired */
  active_candidates: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  closed_at: string | null;
}

/**
 * Candidate entity representing a job applicant
 * 
 * Candidates are created when someone applies to a job.
 * They progress through pipeline stages and receive AI scoring
 * based on their profile data (resume, GitHub, LinkedIn).
 * 
 * @property job_id - The job this candidate applied to
 * @property ai_score - Overall match score (0-100) from AI evaluation
 * @property ai_score_breakdown - Detailed scoring by category (skills, experience, etc.)
 * @property extracted_skills - Skills parsed from resume/GitHub by AI
 * @property stage - Current position in the hiring pipeline
 * @property source - How they found the job (direct, referral, linkedin, etc.)
 */
export interface Candidate {
  id: string;
  job_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  resume_url: string | null;
  resume_filename: string | null;
  resume_text: string | null;
  cover_letter: string | null;
  screening_answers: Json;
  /** AI match score 0-100, null if not yet scored */
  ai_score: number | null;
  /** Breakdown: { skills_match, experience_match, education_match, keywords_match } */
  ai_score_breakdown: Json;
  /** Brief AI-generated summary of candidate fit */
  ai_summary: string | null;
  /** Key strengths identified by AI */
  ai_strengths: string[] | null;
  /** Potential concerns or gaps identified by AI */
  ai_concerns: string[] | null;
  /** Skills extracted from resume/profile by AI */
  extracted_skills: string[] | null;
  /** GitHub profile picture URL */
  avatar_url: string | null;
  years_of_experience: number | null;
  education_level: string | null;
  stage: CandidateStage;
  rejection_reason: string | null;
  rejection_feedback: string | null;
  /** Application source: "direct", "linkedin", "referral", etc. */
  source: string;
  referrer_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  last_activity_at: string;
  is_starred: boolean;
  is_archived: boolean;
  applied_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * AI Interview session
 * 
 * Represents a text-based AI interview for a candidate.
 * The interview consists of personalized questions generated based on
 * the job requirements and candidate's profile.
 * 
 * @property access_token - Unique token for interview URL (candidate authentication)
 * @property expires_at - When the interview link expires
 * @property overall_score - Final interview score (0-100), set after completion
 * @property recommendation - AI's hiring recommendation based on responses
 */
export interface AIInterview {
  id: string;
  candidate_id: string;
  job_id: string;
  /** OpenAI model used for question generation (e.g., "gpt-4o-2024-08-06") */
  model_used: string;
  total_questions: number;
  status: InterviewStatus;
  questions_answered: number;
  /** Secure token for interview access URL */
  access_token: string;
  expires_at: string;
  /** Final interview score (0-100), null until completed */
  overall_score: number | null;
  /** AI-generated summary of interview performance */
  ai_summary: string | null;
  /** Key strengths demonstrated in interview */
  strengths: string[] | null;
  /** Areas of concern from interview responses */
  concerns: string[] | null;
  recommendation: InterviewRecommendation | null;
  sent_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Scheduling fields
  /** When the interview is scheduled to begin */
  scheduled_at: string | null;
  reminder_sent_at: string | null;
  /** Full URL for candidate to access interview */
  interview_link: string | null;
  /** Expected duration in minutes (default: 30) */
  interview_duration_minutes: number;
  candidate_timezone: string | null;
  /** Custom message from recruiter included in invitation */
  custom_message: string | null;
  /** When the interview summary was reviewed by a recruiter */
  reviewed_at: string | null;
  /** UUID of the user who reviewed the interview */
  reviewed_by: string | null;
}

/**
 * Individual interview question with response and evaluation
 * 
 * @property scoring_rubric - Criteria for evaluating the answer (ScoringCriteria[])
 * @property ai_evaluation_breakdown - Detailed per-criterion scores
 */
export interface InterviewQuestion {
  id: string;
  interview_id: string;
  question_text: string;
  /** Context explaining why this question is relevant */
  question_context: string | null;
  category: QuestionCategory | null;
  difficulty: QuestionDifficulty | null;
  /** Order in which question appears (1-indexed) */
  question_order: number;
  estimated_time_minutes: number;
  /** JSON array of ScoringCriteria objects */
  scoring_rubric: Json;
  /** Candidate's text response, null if unanswered */
  candidate_answer: string | null;
  answered_at: string | null;
  /** How long candidate spent on this question */
  time_spent_seconds: number | null;
  /** AI score for this answer (0-10) */
  ai_score: number | null;
  /** AI-generated feedback on the answer */
  ai_feedback: string | null;
  /** Per-criterion evaluation breakdown */
  ai_evaluation_breakdown: Json;
  created_at: string;
}

/**
 * Activity log entry for candidate history
 * Tracks all actions taken on a candidate (stage changes, comments, etc.)
 * 
 * @property activity_type - Type of action (e.g., "stage_change", "note_added")
 * @property metadata - Additional context as JSON
 */
export interface CandidateActivity {
  id: string;
  candidate_id: string;
  /** Profile ID of user who performed action, null for system actions */
  performed_by: string | null;
  activity_type: string;
  metadata: Json;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  /** Internal activities hidden from candidate */
  is_internal: boolean;
  created_at: string;
}

/**
 * Comment/note on a candidate from hiring team
 */
export interface CandidateComment {
  id: string;
  candidate_id: string;
  author_id: string;
  content: string;
  /** Profile IDs of users mentioned with @ */
  mentioned_users: string[];
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Status of background question pre-generation
 * Questions are pre-generated after scoring to enable instant interview scheduling
 */
export type QuestionGenerationStatus = "none" | "pending" | "generating" | "ready" | "failed";

/**
 * Pre-generated interview questions for a candidate
 * 
 * Questions are generated in the background after candidate scoring.
 * This enables instant interview scheduling without waiting for AI generation.
 * 
 * @property status - Generation lifecycle state
 * @property used_in_interview_id - Links to interview if questions were used
 */
export interface PregeneratedQuestions {
  id: string;
  candidate_id: string;
  job_id: string;
  /** Array of GeneratedQuestion objects */
  questions: GeneratedQuestion[];
  total_questions: number;
  /** Total time estimate for all questions in minutes */
  total_estimated_time: number;
  status: "pending" | "generating" | "ready" | "failed" | "used";
  error_message: string | null;
  model_used: string;
  generated_at: string | null;
  /** Timestamp when questions were used to create interview */
  used_at: string | null;
  used_in_interview_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * User notification for in-app alerts
 */
export interface Notification {
  id: string;
  user_id: string;
  /** Notification category (e.g., "new_application", "interview_complete") */
  type: string;
  title: string;
  message: string | null;
  /** Entity type for deep linking (e.g., "candidate", "job") */
  link_type: string | null;
  /** Entity ID for deep linking */
  link_id: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
}

// ============================================================
// AI TYPES - Types for AI-powered features
// These use camelCase to match OpenAI structured output format
// ============================================================

/**
 * Simplified job description for AI question generation
 * Used as input to the question generation API
 */
export interface JobDescription {
  title: string;
  level: JobLevel;
  description: string;
  /** Skills that are required for the role */
  requiredSkills: string[];
  /** Bonus skills that would be nice to have */
  niceToHave: string[];
}

/**
 * Zod schema for validating JobDescription input
 * @see JobDescription
 */
export const JobDescriptionSchema = z.object({
  title: z.string().min(1, "Job title is required"),
  level: z.enum(["junior", "mid", "senior", "staff", "principal"]),
  description: z.string().min(50, "Description should be at least 50 characters"),
  requiredSkills: z.array(z.string()).min(1, "At least one required skill is needed"),
  niceToHave: z.array(z.string()),
});

/**
 * GitHub/portfolio project extracted from candidate profile
 */
export interface CandidateProject {
  name: string;
  description: string;
  /** Primary programming language */
  language: string;
  /** GitHub stars count */
  stars: number;
}

/**
 * Candidate profile data used for AI question generation and scoring
 * 
 * This normalized structure combines data from multiple sources
 * (GitHub, LinkedIn, resume) into a single format for AI processing.
 * 
 * @property source - Where this profile data came from
 * @property languages - Map of programming language to bytes of code (from GitHub)
 */
export interface CandidateProfile {
  source: "github" | "linkedin" | "manual" | "resume";
  /** Profile URL (GitHub/LinkedIn) */
  url?: string;
  name: string;
  bio?: string;
  avatar_url?: string;
  /** Technical and soft skills */
  skills: string[];
  /** Work experience descriptions */
  experience: string[];
  projects?: CandidateProject[];
  /** Programming languages by bytes of code */
  languages?: Record<string, number>;
  years_of_experience?: number;
  /** When GitHub account was created (for experience estimation) */
  github_created_at?: string;
}

/**
 * Zod schema for validating CandidateProfile
 * @see CandidateProfile
 */
export const CandidateProfileSchema = z.object({
  source: z.enum(["github", "linkedin", "manual", "resume"]),
  url: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  bio: z.string().optional(),
  avatar_url: z.string().optional(),
  skills: z.array(z.string()),
  experience: z.array(z.string()),
  projects: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
        language: z.string(),
        stars: z.number(),
      })
    )
    .optional(),
  languages: z.record(z.string(), z.number()).optional(),
  years_of_experience: z.number().optional(),
  github_created_at: z.string().optional(),
});

/**
 * Scoring rubric criteria for evaluating interview answers
 * Each question has multiple criteria with different weights
 * 
 * @example
 * {
 *   aspect: "Technical Accuracy",
 *   weight: 5,
 *   excellent: "Demonstrates deep understanding with specific examples",
 *   good: "Shows solid understanding of core concepts",
 *   needsWork: "Contains inaccuracies or gaps in understanding"
 * }
 */
export interface ScoringCriteria {
  /** What aspect is being evaluated (e.g., "Technical Accuracy") */
  aspect: string;
  /** Importance weight 1-5 */
  weight: number;
  /** Description of an excellent response */
  excellent: string;
  /** Description of a good response */
  good: string;
  /** Description of a response that needs improvement */
  needsWork: string;
}

/**
 * Zod schema for ScoringCriteria with OpenAI descriptions
 * @see ScoringCriteria
 */
export const ScoringCriteriaSchema = z.object({
  aspect: z.string().describe("What is being evaluated"),
  weight: z.number().min(1).max(5).describe("Importance score 1-5"),
  excellent: z.string().describe("What an excellent answer looks like"),
  good: z.string().describe("What a good answer looks like"),
  needsWork: z.string().describe("What indicates needs improvement"),
});

/**
 * AI-generated interview question with scoring rubric
 * 
 * Questions are personalized based on the candidate's background
 * and the job requirements.
 */
export interface GeneratedQuestion {
  /** Unique identifier for the question */
  id: string;
  category: QuestionCategory;
  difficulty: QuestionDifficulty;
  /** The actual question text */
  question: string;
  /** Explanation of why this question is relevant for this candidate */
  context: string;
  /** Multi-dimensional scoring criteria */
  scoringRubric: ScoringCriteria[];
  /** Expected time to answer in minutes */
  estimatedTime: number;
}

/**
 * Zod schema for GeneratedQuestion (OpenAI structured output)
 * @see GeneratedQuestion
 */
export const GeneratedQuestionSchema = z.object({
  id: z.string(),
  category: z.enum(["technical", "behavioral", "system-design", "problem-solving", "culture-fit"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  question: z.string(),
  context: z.string().describe("Why this question is relevant for THIS candidate"),
  scoringRubric: z.array(ScoringCriteriaSchema),
  estimatedTime: z.number().describe("Minutes expected for answer"),
});

/**
 * Complete set of generated interview questions
 * Returned by the question generation API
 */
export interface QuestionSet {
  jobTitle: string;
  candidateName: string;
  /** 6-10 personalized questions */
  questions: GeneratedQuestion[];
  /** Total estimated interview duration in minutes */
  totalEstimatedTime: number;
  /** Questions organized by category for easy access */
  groupedByCategory?: Record<QuestionCategory, GeneratedQuestion[]>;
}

/**
 * Zod schema for QuestionSet (OpenAI structured output)
 * Enforces 6-10 questions constraint
 */
export const QuestionSetSchema = z.object({
  jobTitle: z.string(),
  candidateName: z.string(),
  questions: z.array(GeneratedQuestionSchema).min(6).max(10),
  totalEstimatedTime: z.number(),
});

/**
 * AI-generated follow-up question based on candidate's answer
 */
export interface FollowUpResponse {
  /** The follow-up question text */
  followUp: string;
  /** Explanation of why this follow-up is valuable */
  rationale: string;
}

/**
 * Zod schema for FollowUpResponse (OpenAI structured output)
 */
export const FollowUpResponseSchema = z.object({
  followUp: z.string().describe("The follow-up question"),
  rationale: z.string().describe("Why this follow-up reveals important information"),
});

// ============================================================
// AI SCORING TYPES - Candidate-job matching
// ============================================================

/**
 * AI-generated candidate-job match score
 * 
 * Produced by scoring a candidate against a job's requirements.
 * Used to rank candidates and provide insights to recruiters.
 * 
 * @property overall_score - Weighted score 0-100
 * @property breakdown - Individual category scores
 * @property skills_analysis - Detailed skill matching results
 */
export interface MatchScore {
  /** Overall match score 0-100 */
  overall_score: number;
  /** Score breakdown by evaluation category */
  breakdown: {
    /** Match percentage for required skills (40% weight) */
    skills_match: number;
    /** Match percentage for experience level (30% weight) */
    experience_match: number;
    /** Match percentage for education (15% weight) */
    education_match: number;
    /** Match percentage for industry keywords (15% weight) */
    keywords_match: number;
  };
  /** Detailed analysis of skill matching */
  skills_analysis: {
    /** Required skills the candidate has */
    matched: string[];
    /** Required skills the candidate lacks */
    missing: string[];
    /** Nice-to-have skills the candidate has */
    bonus: string[];
  };
  /** Brief summary of candidate fit (max 500 chars) */
  summary: string;
  /** Top 5 strengths of the candidate */
  strengths: string[];
  /** Top 5 concerns or gaps */
  concerns: string[];
  /** AI hiring recommendation */
  recommendation: InterviewRecommendation;
  /** Detailed explanation of the recommendation */
  reasoning: string;
}

/**
 * Zod schema for MatchScore (OpenAI structured output)
 * @see MatchScore
 */
export const MatchScoreSchema = z.object({
  overall_score: z.number().min(0).max(100),
  breakdown: z.object({
    skills_match: z.number().min(0).max(100),
    experience_match: z.number().min(0).max(100),
    education_match: z.number().min(0).max(100),
    keywords_match: z.number().min(0).max(100),
  }),
  skills_analysis: z.object({
    matched: z.array(z.string()),
    missing: z.array(z.string()),
    bonus: z.array(z.string()).describe("Nice-to-have skills present"),
  }),
  summary: z.string().max(500),
  strengths: z.array(z.string()).max(5),
  concerns: z.array(z.string()).max(5),
  recommendation: z.enum(["strong_yes", "yes", "maybe", "no", "strong_no"]),
  reasoning: z.string().describe("Detailed reasoning for the recommendation"),
});

/**
 * Structured data extracted from a resume by AI
 * 
 * Used to populate candidate profile and enable skill matching.
 */
export interface ParsedResume {
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin_url?: string;
  github_url?: string;
  /** Professional summary or objective */
  summary: string;
  /** All identified skills (technical, soft, tools) */
  skills: string[];
  /** Work experience entries */
  experience: {
    title: string;
    company: string;
    /** Format: "YYYY-MM" */
    start_date: string;
    /** Format: "YYYY-MM" or "Present" */
    end_date?: string;
    description: string;
    /** Key achievements and metrics */
    highlights: string[];
  }[];
  /** Education entries */
  education: {
    degree: string;
    /** Field of study */
    field?: string;
    institution: string;
    graduation_year?: number;
  }[];
  certifications?: string[];
  /** Calculated from work history */
  years_of_experience: number;
  /** Highest level of education */
  education_level: "high_school" | "associate" | "bachelor" | "master" | "phd" | "other";
}

/**
 * Zod schema for ParsedResume (OpenAI structured output)
 * @see ParsedResume
 */
export const ParsedResumeSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin_url: z.string().url().optional(),
  github_url: z.string().url().optional(),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      start_date: z.string(),
      end_date: z.string().optional(),
      description: z.string(),
      highlights: z.array(z.string()),
    })
  ),
  education: z.array(
    z.object({
      degree: z.string(),
      field: z.string().optional(),
      institution: z.string(),
      graduation_year: z.number().optional(),
    })
  ),
  certifications: z.array(z.string()).optional(),
  years_of_experience: z.number(),
  education_level: z.enum(["high_school", "associate", "bachelor", "master", "phd", "other"]),
});

/**
 * AI evaluation of a single interview answer
 * 
 * @property score - Answer quality 0-10
 * @property breakdown - Per-criterion evaluation
 */
export interface AnswerEvaluation {
  /** Overall answer score 0-10 */
  score: number;
  /** Constructive feedback on the answer */
  feedback: string;
  /** Score breakdown by rubric criteria */
  breakdown: {
    /** Criterion being evaluated (from ScoringCriteria.aspect) */
    aspect: string;
    /** Score for this criterion 0-10 */
    score: number;
    /** Specific notes on performance */
    notes: string;
  }[];
  /** Suggested follow-up question if relevant */
  follow_up_suggestion?: string;
}

/**
 * Zod schema for AnswerEvaluation (OpenAI structured output)
 * @see AnswerEvaluation
 */
export const AnswerEvaluationSchema = z.object({
  score: z.number().min(0).max(10),
  feedback: z.string(),
  breakdown: z.array(
    z.object({
      aspect: z.string(),
      score: z.number().min(0).max(10),
      notes: z.string(),
    })
  ),
  follow_up_suggestion: z.string().optional(),
});

// ============================================================
// API TYPES - Request/Response interfaces for REST endpoints
// ============================================================

/**
 * Standard pagination metadata for list endpoints
 */
export interface Pagination {
  /** Total items across all pages */
  total: number;
  /** Current page number (1-indexed) */
  page: number;
  /** Items per page */
  limit: number;
  /** Total number of pages */
  pages: number;
}

/**
 * Standard error response format
 */
export interface ApiError {
  /** Human-readable error message */
  error: string;
  /** Machine-readable error code */
  code: string;
  /** Additional error details (validation errors, etc.) */
  details?: unknown;
}

// ============================================================
// Jobs API Types
// ============================================================

/**
 * Request body for POST /api/jobs
 * @see Job for the full entity
 */
export interface CreateJobRequest {
  title: string;
  level?: JobLevel;
  department?: string;
  location?: string;
  location_type?: LocationType;
  employment_type?: EmploymentType;
  description: string;
  required_skills: string[];
  nice_to_have_skills?: string[];
  salary_min?: number;
  salary_max?: number;
  /** If true, AI will enhance the description */
  use_ai_description?: boolean;
  /** Initial status (default: "draft") */
  status?: "draft" | "active";
}

/**
 * Query parameters for GET /api/jobs
 */
export interface ListJobsQuery {
  /** Filter by job status */
  status?: JobStatus;
  /** Include archived jobs (default: false) */
  include_archived?: boolean;
  /** Page number (default: 1) */
  page?: number;
  /** Items per page (default: 20) */
  limit?: number;
  /** Sort field */
  sort?: "created_at" | "updated_at" | "title";
  /** Sort direction */
  order?: "asc" | "desc";
}

/**
 * Response from GET /api/jobs
 */
export interface ListJobsResponse {
  jobs: Job[];
  pagination: Pagination;
}

// ============================================================
// Candidates API Types
// ============================================================

/**
 * Query parameters for GET /api/candidates
 */
export interface ListCandidatesQuery {
  /** Required: filter by job */
  job_id: string;
  /** Filter by pipeline stage */
  stage?: CandidateStage;
  /** Filter by minimum AI score */
  min_score?: number;
  /** Filter starred candidates only */
  starred?: boolean;
  /** Search in name/email */
  search?: string;
  /** Sort field */
  sort?: "ai_score" | "applied_at" | "last_activity_at";
  /** Sort direction */
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * Response from GET /api/candidates
 * Includes aggregations for filtering UI
 */
export interface ListCandidatesResponse {
  candidates: Candidate[];
  pagination: Pagination;
  /** Aggregated statistics for filter counts */
  aggregations: {
    /** Count of candidates by stage */
    by_stage: Record<CandidateStage, number>;
    /** Score distribution for histogram */
    score_distribution: { range: string; count: number }[];
  };
}

/**
 * Request body for POST /api/candidates/:id/move
 * Moves a candidate to a different pipeline stage
 */
export interface MoveCandidateRequest {
  /** Target stage */
  stage: CandidateStage;
  /** Required when moving to "rejected" */
  rejection_reason?: string;
  /** Optional feedback for the candidate */
  rejection_feedback?: string;
  /** Internal notes about the move */
  notes?: string;
}

// ============================================================
// AI API Types
// ============================================================

/**
 * Request body for POST /api/ai/generate-questions
 */
export interface GenerateQuestionsRequest {
  job: JobDescription;
  candidate: CandidateProfile;
  /** Number of questions to generate (default: 8) */
  question_count?: number;
}

/**
 * Request body for POST /api/ai/score-candidate
 */
export interface ScoreCandidateRequest {
  candidate: {
    skills: string[];
    experience: string[];
    resume_text: string;
  };
  job: {
    title: string;
    level: string;
    required_skills: string[];
    nice_to_have_skills: string[];
    description: string;
  };
}

/**
 * Request body for POST /api/ai/evaluate-answer
 */
export interface EvaluateAnswerRequest {
  question: {
    text: string;
    category: QuestionCategory;
    scoring_rubric: ScoringCriteria[];
  };
  /** Candidate's answer text */
  answer: string;
  /** Job description for context */
  job_context: string;
  /** Candidate background for context */
  candidate_background: string;
}

// ============================================================
// Interview Scheduling API Types
// ============================================================

/**
 * Request body for POST /api/interviews/schedule
 * Schedules a new AI interview for a candidate
 */
export interface ScheduleInterviewRequest {
  candidate_id: string;
  job_id: string;
  /** ISO 8601 datetime when interview should be available */
  scheduled_at: string;
  /** Interview duration in minutes (default: 30) */
  duration_minutes?: number;
  /** Send email invitation immediately (default: true) */
  send_immediate_invite?: boolean;
  /** Custom message to include in invitation email */
  custom_message?: string;
  /** Candidate's timezone for display (e.g., "America/New_York") */
  candidate_timezone?: string;
}

/**
 * Zod schema for validating ScheduleInterviewRequest
 */
export const ScheduleInterviewRequestSchema = z.object({
  candidate_id: z.string().uuid("Invalid candidate ID"),
  job_id: z.string().uuid("Invalid job ID"),
  scheduled_at: z.string().datetime("Invalid datetime format"),
  duration_minutes: z.number().min(15).max(120).optional().default(30),
  send_immediate_invite: z.boolean().optional().default(true),
  custom_message: z.string().max(1000).optional(),
  candidate_timezone: z.string().optional(),
});

/**
 * Response from POST /api/interviews/schedule
 */
export interface ScheduleInterviewResponse {
  interview: AIInterview;
  /** Full URL for candidate to access interview */
  interview_link: string;
  /** Number of questions generated/used */
  questions_generated: number;
}

/**
 * Request body for PATCH /api/interviews/:id (reschedule)
 */
export interface RescheduleInterviewRequest {
  /** New scheduled datetime (ISO 8601) */
  scheduled_at: string;
  /** Send notification email (default: true) */
  send_notification?: boolean;
  /** Reason for rescheduling (included in email) */
  reschedule_reason?: string;
}

/**
 * Zod schema for validating RescheduleInterviewRequest
 */
export const RescheduleInterviewRequestSchema = z.object({
  scheduled_at: z.string().datetime("Invalid datetime format"),
  send_notification: z.boolean().optional().default(true),
  reschedule_reason: z.string().max(500).optional(),
});

/**
 * Request body for POST /api/interviews/:id/start
 * Candidate uses this to begin their interview
 */
export interface StartInterviewRequest {
  /** Access token from interview URL */
  token: string;
}

/**
 * Response from POST /api/interviews/:id/start
 * Contains all questions for the interview
 */
export interface StartInterviewResponse {
  interview_id: string;
  /** All questions to answer */
  questions: InterviewQuestion[];
  /** Total expected duration in minutes */
  total_duration_minutes: number;
  /** When the interview session expires */
  expires_at: string;
}

/**
 * Individual answer submission within interview
 */
export interface SubmitAnswerRequest {
  question_id: string;
  /** Candidate's text answer */
  answer: string;
  /** Time spent on this question in seconds */
  time_spent_seconds: number;
}

/**
 * Request body for POST /api/interviews/:id/submit
 * Submits all answers and completes the interview
 */
export interface SubmitInterviewRequest {
  answers: SubmitAnswerRequest[];
}

/**
 * Response from POST /api/interviews/:id/submit
 */
export interface SubmitInterviewResponse {
  interview_id: string;
  status: InterviewStatus;
  /** Overall score, null if evaluation is pending */
  overall_score: number | null;
  /** AI summary, null if evaluation is pending */
  summary: string | null;
}

/**
 * AIInterview with joined candidate and job data
 * Used for displaying scheduled interviews in the dashboard
 */
export interface ScheduledInterviewWithDetails extends AIInterview {
  candidate?: Pick<Candidate, "id" | "full_name" | "email">;
  job?: Pick<Job, "id" | "title" | "department">;
}

// ============================================================
// UI TYPES - Frontend state and component types
// ============================================================

/**
 * Steps in the interview generation wizard
 */
export type AppStep = "job" | "profile" | "questions";

/**
 * Global UI state for the application
 * Can be used with Zustand or Context
 */
export interface UIState {
  /** Whether sidebar navigation is expanded */
  sidebarOpen: boolean;
  /** Currently selected candidate ID (for detail view) */
  selectedCandidateId: string | null;
  /** Candidate list display mode */
  viewMode: "kanban" | "list" | "grid";
  /** Active filters */
  filters: {
    status?: JobStatus;
    stage?: CandidateStage;
    search?: string;
    minScore?: number;
  };
}

// ============================================================
// PIPELINE STAGES CONFIG
// ============================================================

/**
 * Configuration for pipeline stage display
 * Maps stage IDs to labels, colors, and descriptions
 * 
 * @example
 * const stage = PIPELINE_STAGES.find(s => s.id === candidate.stage);
 * <Badge className={stage.color}>{stage.label}</Badge>
 */
export const PIPELINE_STAGES: {
  id: CandidateStage;
  label: string;
  /** Tailwind CSS background color class */
  color: string;
  description: string;
}[] = [
  { id: "applied", label: "Applied", color: "bg-gray-500", description: "New applications" },
  { id: "screening", label: "Screening", color: "bg-blue-500", description: "AI screening in progress" },
  { id: "ai_interview", label: "AI Interview", color: "bg-purple-500", description: "Text-based AI interview" },
  { id: "phone_screen", label: "Phone Screen", color: "bg-indigo-500", description: "Human phone screen" },
  { id: "technical", label: "Technical", color: "bg-cyan-500", description: "Technical interview" },
  { id: "onsite", label: "Onsite", color: "bg-teal-500", description: "Onsite/final round" },
  { id: "offer", label: "Offer", color: "bg-amber-500", description: "Offer extended" },
  { id: "hired", label: "Hired", color: "bg-green-500", description: "Accepted offer" },
];
