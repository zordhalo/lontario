/**
 * @fileoverview Candidate scoring pipeline
 *
 * Orchestrates the AI scoring process for a single candidate:
 *   1. (cheap, cached) Validate the GitHub username exists.
 *   2. Fetch GitHub profile (cached 6h, capped repos).
 *   3. Optionally fetch LinkedIn via Proxycurl (cached 7d, no-op if no key).
 *   4. Score the candidate with OpenAI (budget-gated).
 *   5. Pre-generate interview questions in-process (budget-gated).
 *
 * Wave 1 cost-DoS BLOCKER fixes implemented here:
 *   - Removed the self-HTTP `fetch` to /api/candidates/[id]/pregenerate-
 *     questions. Question generation now happens via a direct in-process
 *     function call (`pregenerateQuestionsInline`), so the public route is
 *     no longer reachable from this code path.
 *   - Each external step is in its own try/catch + Sentry capture; one
 *     failure does not kill the rest of the pipeline.
 *   - Budget pre-flight (BudgetExceededError) downgrades the pipeline to
 *     "candidate inserted, unscored" instead of bubbling a 500.
 *   - Idempotent: re-running on the same candidate skips steps that have
 *     already written results to the DB.
 *
 * The exported `processAndScoreCandidate` signature is unchanged so the
 * public apply route can call it from inside `after()` without churn.
 *
 * @module lib/ai/scoring
 */

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import {
  fetchGitHubProfile,
  extractGitHubUsername,
  validateGitHubUser,
  scoreCandidate,
  fetchLinkedInProfile,
  generateInterviewQuestions,
} from "@/lib/ai";
import { BudgetExceededError } from "@/lib/ai/openai";
import { env } from "@/lib/env";
import type {
  CandidateProfile,
  MatchScore,
  JobDescription,
} from "@/types";

// ============================================================
// TYPE DEFINITIONS
// ============================================================

/**
 * Candidate data required for scoring.
 * Minimal subset of the Candidate entity.
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
 * Result of the scoring operation. Contains all AI-generated insights to be
 * stored on the candidate.
 */
interface ScoringResult {
  success: boolean;
  ai_score?: number;
  ai_summary?: string;
  ai_strengths?: string[];
  ai_concerns?: string[];
  ai_score_breakdown?: MatchScore["breakdown"];
  extracted_skills?: string[];
  avatar_url?: string;
  years_of_experience?: number;
  error?: string;
}

// ============================================================
// Profile aggregation
// ============================================================

interface AggregatedProfile {
  profile: CandidateProfile;
  resumeText: string;
  avatarUrl?: string;
  yearsOfExperience?: number;
}

/**
 * Pull together everything we know about a candidate from external sources +
 * their submitted resume/cover letter. Each external source is in its own
 * try/catch so a single 503 from GitHub doesn't take down the whole pipeline.
 */
async function aggregateCandidateProfile(
  candidate: CandidateForScoring
): Promise<AggregatedProfile> {
  let profile: CandidateProfile | null = null;
  let resumeText = candidate.resume_text || candidate.cover_letter || "";
  let avatarUrl: string | undefined;
  let yearsOfExperience: number | undefined;

  // --- GitHub ---
  if (candidate.github_url) {
    try {
      const { exists, username } = await validateGitHubUser(
        candidate.github_url
      );
      if (exists && username) {
        const gh = await fetchGitHubProfile(username);
        profile = gh;
        avatarUrl = gh.avatar_url;
        yearsOfExperience = gh.years_of_experience;

        const githubText = [
          `Name: ${gh.name}`,
          gh.bio ? `Bio: ${gh.bio}` : "",
          `Skills: ${gh.skills.join(", ")}`,
          yearsOfExperience ? `Years on GitHub: ${yearsOfExperience}` : "",
          `Experience:`,
          ...gh.experience.map((e) => `- ${e}`),
          gh.projects
            ? `Projects: ${gh.projects.map((p) => `${p.name} (${p.language}, ${p.stars} stars)`).join("; ")}`
            : "",
        ]
          .filter(Boolean)
          .join("\n");

        resumeText = resumeText
          ? `${resumeText}\n\n--- GitHub Profile ---\n${githubText}`
          : githubText;
      } else {
        // Non-existent username — note it but don't fail.
        // eslint-disable-next-line no-console
        console.warn(
          `[lib/ai/scoring] GitHub URL did not resolve: ${candidate.github_url}`
        );
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: "scoring", step: "github" },
      });
    }
  }

  // --- LinkedIn (optional, only when key + budget allow) ---
  if (candidate.linkedin_url && env.PROXYCURL_API_KEY) {
    try {
      const li = await fetchLinkedInProfile(candidate.linkedin_url);
      if (li) {
        // Merge skills/experience; keep GitHub as canonical source if present.
        const mergedSkills = Array.from(
          new Set([...(profile?.skills ?? []), ...li.skills])
        );
        const mergedExperience = [
          ...(profile?.experience ?? []),
          ...li.experience,
        ];
        if (profile) {
          profile = { ...profile, skills: mergedSkills, experience: mergedExperience };
        } else {
          profile = li;
        }
        const liText = [
          li.bio ? `LinkedIn Bio: ${li.bio}` : "",
          li.experience.length ? `LinkedIn Experience:\n${li.experience.map((e) => `- ${e}`).join("\n")}` : "",
        ].filter(Boolean).join("\n");
        if (liText) {
          resumeText = resumeText
            ? `${resumeText}\n\n--- LinkedIn Profile ---\n${liText}`
            : liText;
        }
      }
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: "scoring", step: "linkedin" },
      });
    }
  }

  // Fall back to a minimal profile so the rest of the pipeline has something.
  if (!profile) {
    profile = {
      source: "manual",
      name: candidate.full_name,
      skills: [],
      experience: [],
    };
    if (candidate.cover_letter && !resumeText) {
      resumeText = candidate.cover_letter;
    }
  }

  return { profile, resumeText, avatarUrl, yearsOfExperience };
}

// ============================================================
// Public: single-candidate score
// ============================================================

/**
 * Score a candidate against their job. Pulls profile data, calls OpenAI,
 * returns a structured result. Does NOT write to the database; that's
 * `updateCandidateWithScore`'s job.
 */
export async function scoreCandidateForJob(
  candidate: CandidateForScoring
): Promise<ScoringResult> {
  try {
    const supabase = await createClient();

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", candidate.job_id)
      .single();

    if (jobError || !job) {
      return { success: false, error: "Job not found" };
    }

    const { profile, resumeText, avatarUrl, yearsOfExperience } =
      await aggregateCandidateProfile(candidate);

    if (!resumeText || resumeText.length < 50) {
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

    let matchScore: MatchScore;
    try {
      matchScore = await scoreCandidate(candidateData, jobData);
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        Sentry.captureException(err, {
          tags: { component: "scoring", step: "score", reason: "budget" },
        });
        return {
          success: false,
          error: "AI daily budget exceeded; scoring deferred.",
          extracted_skills: profile?.skills || [],
          avatar_url: avatarUrl,
          years_of_experience: yearsOfExperience,
        };
      }
      throw err;
    }

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
    Sentry.captureException(error, {
      tags: { component: "scoring", step: "score-outer" },
    });

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
 * Persist scoring results on the candidate row.
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
    if (scoringResult.avatar_url) updateData.avatar_url = scoringResult.avatar_url;
    if (scoringResult.years_of_experience !== undefined) {
      updateData.years_of_experience = scoringResult.years_of_experience;
    }
  }

  const { error } = await supabase
    .from("candidates")
    .update(updateData)
    .eq("id", candidateId);

  if (error) {
    Sentry.captureException(error, {
      tags: { component: "scoring", step: "persist" },
    });
    throw new Error("Failed to update candidate with AI score");
  }
}

// ============================================================
// Inline question pre-generation (was a self-HTTP fetch)
// ============================================================

/**
 * Pre-generates interview questions for a candidate by calling
 * `generateInterviewQuestions` directly in-process. No HTTP self-call.
 *
 * Idempotent: returns early if a `ready` or `generating` row exists.
 */
async function pregenerateQuestionsInline(
  candidateId: string
): Promise<void> {
  const supabase = await createClient();

  // Fetch candidate + job in parallel.
  const { data: candidate } = await supabase
    .from("candidates")
    .select("*")
    .eq("id", candidateId)
    .single();
  if (!candidate) return;

  const { data: job } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", candidate.job_id)
    .single();
  if (!job) return;

  // Idempotency: skip if questions already done or in flight.
  const { data: existing } = await supabase
    .from("pregenerated_questions")
    .select("id, status")
    .eq("candidate_id", candidateId)
    .eq("job_id", candidate.job_id)
    .single();

  if (existing?.status === "ready" || existing?.status === "generating") {
    return;
  }

  // Claim the slot. `upsert` so a previous `failed` row gets reused.
  const { data: pregeneratedRecord, error: upsertError } = await supabase
    .from("pregenerated_questions")
    .upsert(
      {
        candidate_id: candidateId,
        job_id: candidate.job_id,
        status: "generating",
        questions: [],
        total_questions: 0,
        total_estimated_time: 0,
      },
      { onConflict: "candidate_id,job_id" }
    )
    .select()
    .single();

  if (upsertError || !pregeneratedRecord) {
    Sentry.captureException(upsertError, {
      tags: { component: "scoring", step: "pregen-claim" },
    });
    return;
  }

  await supabase
    .from("candidates")
    .update({ question_generation_status: "generating" })
    .eq("id", candidateId);

  const jobDescription: JobDescription = {
    title: job.title,
    level: job.level || "mid",
    description: job.description,
    requiredSkills: job.required_skills || [],
    niceToHave: job.nice_to_have_skills || [],
  };

  const candidateProfile: CandidateProfile = {
    source: candidate.github_url
      ? "github"
      : candidate.linkedin_url
        ? "linkedin"
        : "resume",
    name: candidate.full_name,
    url: candidate.github_url || candidate.linkedin_url || undefined,
    bio: candidate.ai_summary || undefined,
    skills: candidate.extracted_skills || [],
    experience: candidate.resume_text
      ? [candidate.resume_text.slice(0, 500)]
      : [],
  };

  try {
    const questionSet = await generateInterviewQuestions(
      jobDescription,
      candidateProfile
    );

    await supabase
      .from("pregenerated_questions")
      .update({
        questions: questionSet.questions,
        total_questions: questionSet.questions.length,
        total_estimated_time: questionSet.totalEstimatedTime,
        status: "ready",
        generated_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", pregeneratedRecord.id);

    await supabase
      .from("candidates")
      .update({ question_generation_status: "ready" })
      .eq("id", candidateId);
  } catch (err) {
    Sentry.captureException(err, {
      tags: {
        component: "scoring",
        step: "pregen-generate",
        reason: err instanceof BudgetExceededError ? "budget" : "unknown",
      },
    });

    await supabase
      .from("pregenerated_questions")
      .update({
        status: "failed",
        error_message:
          err instanceof Error ? err.message : "AI generation failed",
      })
      .eq("id", pregeneratedRecord.id);

    await supabase
      .from("candidates")
      .update({ question_generation_status: "failed" })
      .eq("id", candidateId);
  }
}

// ============================================================
// Public: full pipeline (idempotent)
// ============================================================

/**
 * Full pipeline: score + persist + pre-generate questions.
 *
 * Idempotent: re-running on the same candidate skips work that has already
 * been completed by checking the candidate row's existing `ai_score` and the
 * `pregenerated_questions.status` field.
 *
 * This function is safe to pass to Vercel's `after()` / `waitUntil()` from
 * the public apply route. It MUST NOT make HTTP requests back into this
 * server — call internal helpers directly.
 */
export async function processAndScoreCandidate(
  candidate: CandidateForScoring
): Promise<ScoringResult> {
  // Idempotency check: if this candidate is already scored, skip.
  let result: ScoringResult;
  try {
    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("candidates")
      .select("ai_score, ai_summary, ai_strengths, ai_concerns, ai_score_breakdown, extracted_skills, avatar_url, years_of_experience")
      .eq("id", candidate.id)
      .single();

    if (existing && typeof existing.ai_score === "number" && existing.ai_score > 0) {
      result = {
        success: true,
        ai_score: existing.ai_score,
        ai_summary: existing.ai_summary ?? undefined,
        ai_strengths: existing.ai_strengths ?? undefined,
        ai_concerns: existing.ai_concerns ?? undefined,
        ai_score_breakdown: existing.ai_score_breakdown ?? undefined,
        extracted_skills: existing.extracted_skills ?? undefined,
        avatar_url: existing.avatar_url ?? undefined,
        years_of_experience: existing.years_of_experience ?? undefined,
      };
    } else {
      result = await scoreCandidateForJob(candidate);
      try {
        await updateCandidateWithScore(candidate.id, result);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { component: "scoring", step: "persist-outer" },
        });
      }
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: "scoring", step: "idempotency-check" },
    });
    result = await scoreCandidateForJob(candidate);
    try {
      await updateCandidateWithScore(candidate.id, result);
    } catch (innerErr) {
      Sentry.captureException(innerErr, {
        tags: { component: "scoring", step: "persist-outer" },
      });
    }
  }

  // Pre-generate questions only if scoring produced something useful.
  // No self-HTTP fetch — direct in-process call.
  if (result.success) {
    try {
      await pregenerateQuestionsInline(candidate.id);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: "scoring", step: "pregen-outer" },
      });
    }
  }

  return result;
}
