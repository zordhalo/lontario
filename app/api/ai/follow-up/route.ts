import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { generateFollowUpQuestion } from "@/lib/ai";
import { GeneratedQuestionSchema, JobDescriptionSchema } from "@/types";

// Validation schema
const followUpSchema = z.object({
  originalQuestion: GeneratedQuestionSchema,
  candidateAnswer: z.string().min(10, "Answer must be at least 10 characters"),
  jobDescription: JobDescriptionSchema,
});

/**
 * POST /api/ai/follow-up
 * Generate an intelligent follow-up question based on candidate's answer
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify authentication (optional for demo)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Parse and validate request body
    const body = await req.json();
    const validation = followUpSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { originalQuestion, candidateAnswer, jobDescription } = validation.data;

    // Generate follow-up using AI
    const followUp = await generateFollowUpQuestion(
      originalQuestion,
      candidateAnswer,
      jobDescription
    );

    return NextResponse.json({
      ...followUp,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating follow-up:", error);

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
      { error: "Failed to generate follow-up question", code: "AI_ERROR" },
      { status: 500 }
    );
  }
}
