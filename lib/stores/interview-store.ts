/**
 * @fileoverview Zustand store for interview generation wizard
 * 
 * This store manages the state for the 3-step interview generation flow:
 * 1. Job Details - Enter job requirements and skills
 * 2. Candidate Profile - Fetch from GitHub/LinkedIn or enter manually
 * 3. Questions - View generated personalized interview questions
 * 
 * The store handles navigation between steps, data persistence,
 * and the async question generation API call.
 * 
 * @module lib/stores/interview-store
 */

"use client"

import { create } from "zustand"
import type {
  JobDescription,
  CandidateProfile,
  QuestionSet,
  AppStep,
} from "@/types"

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Interview generation wizard state and actions
 */
interface InterviewState {
  // ==================== State ====================
  /** Current wizard step */
  currentStep: AppStep
  /** Job description from step 1 */
  job: JobDescription | null
  /** Candidate profile from step 2 */
  candidate: CandidateProfile | null
  /** Generated questions from step 3 */
  questions: QuestionSet | null
  /** Whether question generation is in progress */
  isLoading: boolean
  /** Error message from failed operations */
  error: string | null

  // ==================== Synchronous Actions ====================
  /** Navigate to a specific step */
  setCurrentStep: (step: AppStep) => void
  /** Set job and advance to profile step */
  setJob: (job: JobDescription) => void
  /** Set candidate profile */
  setCandidate: (candidate: CandidateProfile) => void
  /** Set questions and advance to questions step */
  setQuestions: (questions: QuestionSet) => void
  /** Set loading state */
  setLoading: (loading: boolean) => void
  /** Set error state */
  setError: (error: string | null) => void
  /** Reset all state to initial values */
  reset: () => void
  /** Navigate back one step */
  goBack: () => void

  // ==================== Async Actions ====================
  /** Generate questions using the AI API */
  generateQuestions: () => Promise<void>
}

/** Initial/reset state values */
const initialState = {
  currentStep: "job" as AppStep,
  job: null,
  candidate: null,
  questions: null,
  isLoading: false,
  error: null,
}

/**
 * Zustand store for interview generation wizard
 * 
 * @example
 * // In a component
 * const { job, setJob, generateQuestions, isLoading } = useInterviewStore();
 * 
 * // Set job and auto-advance to profile step
 * setJob({ title: "Senior Engineer", ... });
 * 
 * // Generate questions (requires job and candidate)
 * await generateQuestions();
 */
export const useInterviewStore = create<InterviewState>((set, get) => ({
  // Initial state
  ...initialState,

  // Set current step
  setCurrentStep: (step) => set({ currentStep: step }),

  // Set job and advance to profile step
  setJob: (job) => set({ job, currentStep: "profile", error: null }),

  // Set candidate profile
  setCandidate: (candidate) => set({ candidate, error: null }),

  // Set generated questions and advance to questions step
  setQuestions: (questions) =>
    set({ questions, currentStep: "questions", isLoading: false }),

  // Set loading state
  setLoading: (loading) => set({ isLoading: loading }),

  // Set error state
  setError: (error) => set({ error, isLoading: false }),

  // Reset all state to initial values
  reset: () => set(initialState),

  // Navigate back one step
  goBack: () => {
    const { currentStep } = get()
    if (currentStep === "profile") {
      set({ currentStep: "job" })
    } else if (currentStep === "questions") {
      set({ currentStep: "profile", questions: null })
    }
  },

  // Generate questions using the API
  generateQuestions: async () => {
    const { job, candidate } = get()

    if (!job || !candidate) {
      set({ error: "Job description and candidate profile are required" })
      return
    }

    set({ isLoading: true, error: null })

    try {
      const response = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job, candidate }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate questions")
      }

      const questions = await response.json()
      set({ questions, currentStep: "questions", isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "An error occurred",
        isLoading: false,
      })
    }
  },
}))
