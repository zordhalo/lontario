import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evaluateAnswer } from "@/lib/ai";
import { ScoringCriteriaSchema } from "@/types";

// Validation schema
const evaluateAnswerSchema = z.object({
  question: z.object({
    text: z.string(),
    category: z.enum(["technical", "behavioral", "system-design", "problem-solving", "culture-fit"]),
    scoring_rubric: z.array(ScoringCriteriaSchema),
  }),
  answer: z.string().min(10, "Answer must be at least 10 characters"),
  job_context: z.string(),
  candidate_background: z.string(),
});

/**
 * POST /api/ai/evaluate-answer
 * Evaluate a candidate's interview answer using AI (MVP: no auth required)
 */
export async function POST(req: NextRequest) {
  try {
    // MVP: Auth disabled

    // Parse and validate request body
    const body = await req.json();
    const validation = evaluateAnswerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { question, answer, job_context, candidate_background } = validation.data;

    // Evaluate answer using AI
    const evaluation = await evaluateAnswer(
      question,
      answer,
      job_context,
      candidate_background
    );

    return NextResponse.json({
      ...evaluation,
      evaluated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error evaluating answer:", error);

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
      { error: "Failed to evaluate answer", code: "AI_ERROR" },
      { status: 500 }
    );
  }
}
