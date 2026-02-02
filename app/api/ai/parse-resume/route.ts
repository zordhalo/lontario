import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseResume } from "@/lib/ai";

// Validation schema
const parseResumeSchema = z.object({
  resume_text: z.string().min(100, "Resume text must be at least 100 characters"),
  job_context: z
    .object({
      title: z.string(),
      required_skills: z.array(z.string()),
    })
    .optional(),
});

/**
 * POST /api/ai/parse-resume
 * Extract structured data from resume text using AI (MVP: no auth required)
 */
export async function POST(req: NextRequest) {
  try {
    // MVP: Auth disabled

    // Parse and validate request body
    const body = await req.json();
    const validation = parseResumeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { resume_text } = validation.data;

    // Parse resume using AI
    const parsedResume = await parseResume(resume_text);

    return NextResponse.json({
      ...parsedResume,
      parsed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error parsing resume:", error);

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
      { error: "Failed to parse resume", code: "AI_ERROR" },
      { status: 500 }
    );
  }
}
