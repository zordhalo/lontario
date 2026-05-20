import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateInterviewQuestions } from "@/lib/ai";
import { JobDescriptionSchema, CandidateProfileSchema, QuestionCategory, GeneratedQuestion } from "@/types";
import { authErrorResponse, requireRecruiter } from "@/lib/supabase/auth-helpers";

// Validation schema
const generateQuestionsSchema = z.object({
  job: JobDescriptionSchema,
  candidate: CandidateProfileSchema,
  question_count: z.number().min(6).max(10).optional().default(8),
});

/**
 * POST /api/ai/generate-questions
 * Generate personalized interview questions for a candidate.
 * Requires recruiter session.
 */
export async function POST(req: NextRequest) {
  try {
    const { user } = await requireRecruiter();

    // Parse and validate request body
    const body = await req.json();
    const validation = generateQuestionsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { job, candidate } = validation.data;

    // Generate questions using AI
    const questionSet = await generateInterviewQuestions(job, candidate);

    // Group questions by category for easier display
    const groupedByCategory: Record<QuestionCategory, GeneratedQuestion[]> = {
      technical: [],
      behavioral: [],
      "system-design": [],
      "problem-solving": [],
      "culture-fit": [],
    };

    questionSet.questions.forEach((q) => {
      if (groupedByCategory[q.category]) {
        groupedByCategory[q.category].push(q);
      }
    });

    // Calculate total estimated time
    const totalEstimatedTime = questionSet.questions.reduce(
      (sum, q) => sum + q.estimatedTime,
      0
    );

    return NextResponse.json({
      ...questionSet,
      groupedByCategory,
      totalEstimatedTime,
      generated_at: new Date().toISOString(),
      generated_by: user.id,
    });
  } catch (error) {
    const authResp = authErrorResponse(error);
    if (authResp) return authResp;
    console.error("Error generating questions:", error);

    // Handle specific OpenAI errors
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
      { error: "Failed to generate questions", code: "AI_ERROR" },
      { status: 500 }
    );
  }
}
