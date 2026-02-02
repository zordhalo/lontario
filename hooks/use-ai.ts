/**
 * @fileoverview React Query hooks for AI operations
 * 
 * This module provides client-side hooks for all AI-powered features:
 * - Question generation
 * - Candidate scoring
 * - Resume parsing
 * - Answer evaluation
 * - Follow-up question generation
 * - Profile scraping
 * 
 * All hooks use React Query mutations for proper loading/error states.
 * 
 * @module hooks/use-ai
 */

"use client";

import { useMutation } from "@tanstack/react-query";
import type {
  JobDescription,
  CandidateProfile,
  QuestionSet,
  MatchScore,
  ParsedResume,
  AnswerEvaluation,
  FollowUpResponse,
  GeneratedQuestion,
  QuestionCategory,
  ScoringCriteria,
} from "@/types";

// ============================================================
// API FUNCTIONS - Internal fetch wrappers
// ============================================================

/**
 * Calls the question generation API
 * @internal
 */
async function generateQuestions(
  job: JobDescription,
  candidate: CandidateProfile,
  questionCount?: number
): Promise<QuestionSet> {
  const response = await fetch("/api/ai/generate-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job, candidate, question_count: questionCount }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to generate questions");
  }
  return response.json();
}

async function scoreCandidate(
  candidate: {
    skills: string[];
    experience: string[];
    resume_text: string;
    years_of_experience?: number;
    education_level?: string;
  },
  job: {
    title: string;
    level: string;
    required_skills: string[];
    nice_to_have_skills?: string[];
    description: string;
  }
): Promise<MatchScore> {
  const response = await fetch("/api/ai/score-candidate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate, job }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to score candidate");
  }
  return response.json();
}

async function parseResume(resumeText: string): Promise<ParsedResume> {
  const response = await fetch("/api/ai/parse-resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume_text: resumeText }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to parse resume");
  }
  return response.json();
}

async function evaluateAnswer(
  question: {
    text: string;
    category: QuestionCategory;
    scoring_rubric: ScoringCriteria[];
  },
  answer: string,
  jobContext: string,
  candidateBackground: string
): Promise<AnswerEvaluation> {
  const response = await fetch("/api/ai/evaluate-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      answer,
      job_context: jobContext,
      candidate_background: candidateBackground,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to evaluate answer");
  }
  return response.json();
}

async function generateFollowUp(
  originalQuestion: GeneratedQuestion,
  candidateAnswer: string,
  jobDescription: JobDescription
): Promise<FollowUpResponse> {
  const response = await fetch("/api/ai/follow-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      originalQuestion,
      candidateAnswer,
      jobDescription,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to generate follow-up");
  }
  return response.json();
}

async function scrapeProfile(
  url: string,
  source?: "github" | "linkedin"
): Promise<{ profile: CandidateProfile; fetched_at: string }> {
  const response = await fetch("/api/ai/scrape-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, source }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to scrape profile");
  }
  return response.json();
}

// ============================================================
// REACT QUERY HOOKS - Client-side AI operations
// ============================================================

/**
 * Hook for generating personalized interview questions
 * 
 * @returns Mutation object with mutate function and state
 * 
 * @example
 * const { mutate, isPending, data } = useGenerateQuestions();
 * mutate({ job, candidate, questionCount: 8 });
 */
export function useGenerateQuestions() {
  return useMutation({
    mutationFn: ({
      job,
      candidate,
      questionCount,
    }: {
      job: JobDescription;
      candidate: CandidateProfile;
      questionCount?: number;
    }) => generateQuestions(job, candidate, questionCount),
  });
}

/**
 * Hook for scoring a candidate against job requirements
 * 
 * @returns Mutation object with mutate function and state
 * 
 * @example
 * const { mutate, isPending } = useScoreCandidate();
 * mutate({ candidate: candidateData, job: jobData });
 */
export function useScoreCandidate() {
  return useMutation({
    mutationFn: ({
      candidate,
      job,
    }: {
      candidate: {
        skills: string[];
        experience: string[];
        resume_text: string;
        years_of_experience?: number;
        education_level?: string;
      };
      job: {
        title: string;
        level: string;
        required_skills: string[];
        nice_to_have_skills?: string[];
        description: string;
      };
    }) => scoreCandidate(candidate, job),
  });
}

/**
 * Hook for parsing resume text into structured data
 * 
 * @returns Mutation object with mutate function and state
 * 
 * @example
 * const { mutate, data } = useParseResume();
 * mutate(resumeText);
 * // data contains ParsedResume with skills, experience, etc.
 */
export function useParseResume() {
  return useMutation({
    mutationFn: (resumeText: string) => parseResume(resumeText),
  });
}

/**
 * Hook for evaluating a candidate's interview answer
 * 
 * @returns Mutation object with mutate function and state
 * 
 * @example
 * const { mutate, data } = useEvaluateAnswer();
 * mutate({ question, answer, jobContext, candidateBackground });
 * // data.score is 0-10, data.feedback has constructive feedback
 */
export function useEvaluateAnswer() {
  return useMutation({
    mutationFn: ({
      question,
      answer,
      jobContext,
      candidateBackground,
    }: {
      question: {
        text: string;
        category: QuestionCategory;
        scoring_rubric: ScoringCriteria[];
      };
      answer: string;
      jobContext: string;
      candidateBackground: string;
    }) => evaluateAnswer(question, answer, jobContext, candidateBackground),
  });
}

/**
 * Hook for generating a follow-up question based on candidate's answer
 * 
 * @returns Mutation object with mutate function and state
 * 
 * @example
 * const { mutate, data } = useGenerateFollowUp();
 * mutate({ originalQuestion, candidateAnswer, jobDescription });
 * // data.followUp contains the follow-up question
 */
export function useGenerateFollowUp() {
  return useMutation({
    mutationFn: ({
      originalQuestion,
      candidateAnswer,
      jobDescription,
    }: {
      originalQuestion: GeneratedQuestion;
      candidateAnswer: string;
      jobDescription: JobDescription;
    }) => generateFollowUp(originalQuestion, candidateAnswer, jobDescription),
  });
}

/**
 * Hook for scraping a GitHub or LinkedIn profile
 * 
 * @returns Mutation object with mutate function and state
 * 
 * @example
 * const { mutate, data } = useScrapeProfile();
 * mutate({ url: "https://github.com/username", source: "github" });
 * // data.profile contains CandidateProfile
 */
export function useScrapeProfile() {
  return useMutation({
    mutationFn: ({
      url,
      source,
    }: {
      url: string;
      source?: "github" | "linkedin";
    }) => scrapeProfile(url, source),
  });
}
