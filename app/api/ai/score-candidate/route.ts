import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scoreCandidate } from "@/lib/ai";
import { authErrorResponse, requireRecruiter } from "@/lib/supabase/auth-helpers";

// Validation schema
const scoreCandidateSchema = z.object({
  candidate: z.object({
    skills: z.array(z.string()),
    experience: z.array(z.string()),
    resume_text: z.string().min(100, "Resume text must be at least 100 characters"),
    years_of_experience: z.number().optional(),
    education_level: z.string().optional(),
  }),
  job: z.object({
    title: z.string(),
    level: z.string(),
    required_skills: z.array(z.string()),
    nice_to_have_skills: z.array(z.string()).optional(),
    description: z.string(),
  }),
});

/**
 * POST /api/ai/score-candidate
 * Calculate AI match score between a candidate and job.
 * Requires recruiter session.
 *
 * NOTE for w3-ai-cost-controls: public application scoring happens via
 * `lib/ai/scoring.ts:processAndScoreCandidate` invoked directly from
 * `/api/public/apply`. That call path does NOT hit this endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    await requireRecruiter();

    // Parse and validate request body
    const body = await req.json();
    const validation = scoreCandidateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { candidate, job } = validation.data;

    // Generate score using AI
    const matchScore = await scoreCandidate(candidate, job);

    return NextResponse.json({
      ...matchScore,
      scored_at: new Date().toISOString(),
    });
  } catch (error) {
    const authResp = authErrorResponse(error);
    if (authResp) return authResp;
    console.error("Error scoring candidate:", error);

    if (error instanceof Error) {
      if (error.message.includes("OPENAI_API_KEY")) {
        return NextResponse.json(
          { error: "AI service not configured", code: "AI_NOT_CONFIGURED" },
          { status: 503 }
        );
      }

      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { error: "AI rate limit exceeded. Please try again later.", code: "RATE_LIMITED" },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to score candidate", code: "AI_ERROR" },
      { status: 500 }
    );
  }
}
