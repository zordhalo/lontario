/**
 * @fileoverview Candidate scoring pipeline
 * 
 * This module orchestrates the AI scoring process for candidates:
 * 1. Fetches profile data from GitHub/LinkedIn
 * 2. Combines with resume/cover letter data
 * 3. Calls AI scoring to evaluate job fit
 * 4. Updates candidate record with results
 * 5. Triggers background question pre-generation
 * 
 * The main entry point is `processAndScoreCandidate()` which runs
 * the complete pipeline after a new candidate is created.
 * 
 * @module lib/ai/scoring
 */

import { createClient } from "@/lib/supabase/server";
import {
  fetchGitHubProfile,
  extractGitHubUsername,
  isGitHubUrl,
  scoreCandidate,
} from "@/lib/ai";
import { getAppUrl } from "@/lib/utils";
import type { CandidateProfile, MatchScore, Job } from "@/types";

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Candidate data required for scoring
 * Minimal subset of Candidate entity
 */
interface CandidateForScoring {
  id: string;
  job_id: string;
  full_name: string;
  email: string;
  github_url?: string | null;
  linkedin_url?: string | null;
  cover_letter?: string | null;
  resume_text?: string | null;
}

/**
 * Result of the scoring operation
 * Contains all AI-generated insights to be stored on the candidate
 */
interface ScoringResult {
  /** Whether scoring completed successfully */
  success: boolean;
  /** Overall match score (0-100) */
  ai_score?: number;
  /** Brief summary of candidate fit */
  ai_summary?: string;
  /** Key strengths identified */
  ai_strengths?: string[];
  /** Potential concerns or gaps */
  ai_concerns?: string[];
  /** Detailed score breakdown by category */
  ai_score_breakdown?: MatchScore["breakdown"];
  /** Skills extracted from profile/resume */
  extracted_skills?: string[];
  /** GitHub avatar URL if available */
  avatar_url?: string;
  /** Years of experience from GitHub/resume */
  years_of_experience?: number;
  /** Error message if scoring failed */
  error?: string;
}

/**
 * Fetches candidate profile data from GitHub (and potentially LinkedIn)
 * Returns a CandidateProfile with skills and experience extracted
 */
async function fetchCandidateProfileData(
  candidate: CandidateForScoring
): Promise<{ profile: CandidateProfile | null; resumeText: string; avatarUrl?: string; yearsOfExperience?: number }> {
  let profile: CandidateProfile | null = null;
  let resumeText = candidate.resume_text || candidate.cover_letter || "";
  let avatarUrl: string | undefined;
  let yearsOfExperience: number | undefined;

  // Try to fetch GitHub profile if URL provided
  if (candidate.github_url) {
    try {
      const username = extractGitHubUsername(candidate.github_url);
      if (username) {
        profile = await fetchGitHubProfile(username);
        
        // Extract avatar URL and years of experience from GitHub profile
        avatarUrl = profile.avatar_url;
        yearsOfExperience = profile.years_of_experience;
        
        // Build resume text from GitHub data
        const githubText = [
          `Name: ${profile.name}`,
          profile.bio ? `Bio: ${profile.bio}` : "",
          `Skills: ${profile.skills.join(", ")}`,
          yearsOfExperience ? `Years on GitHub: ${yearsOfExperience}` : "",
          `Experience:`,
          ...profile.experience.map((e) => `- ${e}`),
          profile.projects
            ? `Projects: ${profile.projects.map((p) => `${p.name} (${p.language}, ${p.stars} stars)`).join("; ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        resumeText = resumeText
          ? `${resumeText}\n\n--- GitHub Profile ---\n${githubText}`
          : githubText;
      }
    } catch (error) {
      console.error("Failed to fetch GitHub profile:", error);
      // Continue without GitHub data
    }
  }

  // If no profile fetched, create a minimal one from available data
  if (!profile) {
    profile = {
      source: "manual",
      name: candidate.full_name,
      skills: [],
      experience: [],
    };

    // Try to extract some info from cover letter if available
    if (candidate.cover_letter) {
      resumeText = candidate.cover_letter;
    }
  }

  return { profile, resumeText, avatarUrl, yearsOfExperience };
}

/**
 * Scores a candidate against a job using AI
 * Fetches profile data, calls scoring API, and returns results
 */
export async function scoreCandidateForJob(
  candidate: CandidateForScoring
): Promise<ScoringResult> {
  try {
    const supabase = await createClient();

    // Fetch the job details
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", candidate.job_id)
      .single();

    if (jobError || !job) {
      return {
        success: false,
        error: "Job not found",
      };
    }

    // Fetch candidate profile data from GitHub/LinkedIn
    const { profile, resumeText, avatarUrl, yearsOfExperience } = await fetchCandidateProfileData(candidate);

    // If we don't have enough data to score, return early
    if (!resumeText || resumeText.length < 50) {
      // Not enough data for AI scoring - set a default score
      return {
        success: true,
        ai_score: 0,
        ai_summary:
          "Insufficient profile data for AI scoring. Add a resume, cover letter, or GitHub profile for better matching.",
        ai_strengths: [],
        ai_concerns: ["No resume or profile data available for analysis"],
        extracted_skills: profile?.skills || [],
        avatar_url: avatarUrl,
        years_of_experience: yearsOfExperience,
      };
    }

    // Prepare data for scoring
    const candidateData = {
      skills: profile?.skills || [],
      experience: profile?.experience || [],
      resume_text: resumeText,
      years_of_experience: undefined,
      education_level: undefined,
    };

    const jobData = {
      title: job.title,
      level: job.level || "mid",
      required_skills: job.required_skills || [],
      nice_to_have_skills: job.nice_to_have_skills || [],
      description: job.description,
    };

    // Call the AI scoring function
    const matchScore = await scoreCandidate(candidateData, jobData);

    return {
      success: true,
      ai_score: matchScore.overall_score,
      ai_summary: matchScore.summary,
      ai_strengths: matchScore.strengths,
      ai_concerns: matchScore.concerns,
      ai_score_breakdown: matchScore.breakdown,
      extracted_skills: [
        ...matchScore.skills_analysis.matched,
        ...matchScore.skills_analysis.bonus,
      ],
      avatar_url: avatarUrl,
      years_of_experience: yearsOfExperience,
    };
  } catch (error) {
    console.error("Error scoring candidate:", error);

    // Check for specific errors
    if (error instanceof Error) {
      if (error.message.includes("OPENAI_API_KEY")) {
        return {
          success: false,
          error: "AI service not configured. Please set OPENAI_API_KEY.",
        };
      }
      if (error.message.includes("rate limit")) {
        return {
          success: false,
          error: "AI rate limit exceeded. Please try again later.",
        };
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to score candidate",
    };
  }
}

/**
 * Updates a candidate record with AI scoring results
 */
export async function updateCandidateWithScore(
  candidateId: string,
  scoringResult: ScoringResult
): Promise<void> {
  const supabase = await createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (scoringResult.success) {
    updateData.ai_score = scoringResult.ai_score;
    updateData.ai_summary = scoringResult.ai_summary;
    updateData.ai_strengths = scoringResult.ai_strengths;
    updateData.ai_concerns = scoringResult.ai_concerns;
    updateData.ai_score_breakdown = scoringResult.ai_score_breakdown;
    updateData.extracted_skills = scoringResult.extracted_skills;
    
    // Store GitHub profile data
    if (scoringResult.avatar_url) {
      updateData.avatar_url = scoringResult.avatar_url;
    }
    if (scoringResult.years_of_experience !== undefined) {
      updateData.years_of_experience = scoringResult.years_of_experience;
    }
  }

  const { error } = await supabase
    .from("candidates")
    .update(updateData)
    .eq("id", candidateId);

  if (error) {
    console.error("Failed to update candidate with score:", error);
    throw new Error("Failed to update candidate with AI score");
  }
}

/**
 * Full pipeline: score a candidate and update their record
 * This is the main function to call after creating a candidate
 */
export async function processAndScoreCandidate(
  candidate: CandidateForScoring
): Promise<ScoringResult> {
  const result = await scoreCandidateForJob(candidate);

  // Update the candidate record with the results
  await updateCandidateWithScore(candidate.id, result);

  // Trigger pre-generation of interview questions in the background
  // This makes scheduling interviews instant later
  triggerQuestionPregeneration(candidate.id).catch((error) => {
    console.error("Background question pre-generation failed:", error);
  });

  return result;
}

/**
 * Triggers pre-generation of interview questions for a candidate
 * This runs asynchronously after candidate scoring to prepare for fast interview scheduling
 */
async function triggerQuestionPregeneration(candidateId: string): Promise<void> {
  const baseUrl = getAppUrl();
  
  try {
    const response = await fetch(
      `${baseUrl}/api/candidates/${candidateId}/pregenerate-questions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error("Question pre-generation API error:", error);
    }
  } catch (error) {
    console.error("Failed to trigger question pre-generation:", error);
  }
}
