import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { processAndScoreCandidate } from "@/lib/ai";

// Validation schemas
const listCandidatesSchema = z.object({
  job_id: z.string().uuid(),
  stage: z
    .enum([
      "applied",
      "screening",
      "ai_interview",
      "phone_screen",
      "technical",
      "onsite",
      "offer",
      "hired",
      "rejected",
    ])
    .optional(),
  min_score: z.coerce.number().min(0).max(100).optional(),
  starred: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  search: z.string().optional(),
  sort: z
    .enum(["ai_score", "applied_at", "last_activity_at"])
    .default("applied_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
});

const createCandidateSchema = z.object({
  job_id: z.string().uuid(),
  email: z.string().email(),
  full_name: z.string().min(1),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin_url: z.string().url().optional(),
  github_url: z.string().url().optional(),
  portfolio_url: z.string().url().optional(),
  cover_letter: z.string().optional(),
  screening_answers: z.array(z.unknown()).optional(),
  source: z.string().default("direct"),
});

/**
 * GET /api/candidates
 * List candidates for a job (MVP: no auth required)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // MVP: Auth disabled

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const validation = listCandidatesSchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { job_id, stage, min_score, starred, search, sort, order, page, limit } =
      validation.data;
    const offset = (page - 1) * limit;

    // MVP: Skip job ownership check - just verify job exists
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Build query
    let query = supabase
      .from("candidates")
      .select("*", { count: "exact" })
      .eq("job_id", job_id)
      .eq("is_archived", false);

    if (stage) {
      query = query.eq("stage", stage);
    }

    if (min_score !== undefined) {
      query = query.gte("ai_score", min_score);
    }

    if (starred !== undefined) {
      query = query.eq("is_starred", starred);
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    // Handle sorting with nulls
    if (sort === "ai_score") {
      query = query.order(sort, {
        ascending: order === "asc",
        nullsFirst: false,
      });
    } else {
      query = query.order(sort, { ascending: order === "asc" });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: candidates, error: dbError, count } = await query;

    if (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Failed to fetch candidates", code: "DB_ERROR" },
        { status: 500 }
      );
    }

    // Calculate aggregations
    const { data: allCandidates } = await supabase
      .from("candidates")
      .select("stage, ai_score")
      .eq("job_id", job_id)
      .eq("is_archived", false);

    const byStage: Record<string, number> = {};
    const scoreDistribution = [
      { range: "90-100", count: 0 },
      { range: "80-89", count: 0 },
      { range: "70-79", count: 0 },
      { range: "60-69", count: 0 },
      { range: "0-59", count: 0 },
    ];

    allCandidates?.forEach((c) => {
      byStage[c.stage] = (byStage[c.stage] || 0) + 1;

      if (c.ai_score !== null) {
        if (c.ai_score >= 90) scoreDistribution[0].count++;
        else if (c.ai_score >= 80) scoreDistribution[1].count++;
        else if (c.ai_score >= 70) scoreDistribution[2].count++;
        else if (c.ai_score >= 60) scoreDistribution[3].count++;
        else scoreDistribution[4].count++;
      }
    });

    return NextResponse.json({
      candidates,
      pagination: {
        total: count ?? 0,
        page,
        limit,
        pages: Math.ceil((count ?? 0) / limit),
      },
      aggregations: {
        by_stage: byStage,
        score_distribution: scoreDistribution,
      },
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/candidates:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/candidates
 * Create a new candidate (for public applications or manual entry)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Parse and validate request body
    const body = await req.json();
    const validation = createCandidateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const candidateData = validation.data;

    // Verify job exists and is active (for public applications)
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id, status")
      .eq("id", candidateData.job_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    if (job.status !== "active") {
      return NextResponse.json(
        { error: "Job is not accepting applications", code: "JOB_CLOSED" },
        { status: 400 }
      );
    }

    // Check for duplicate application
    const { data: existing } = await supabase
      .from("candidates")
      .select("id")
      .eq("job_id", candidateData.job_id)
      .eq("email", candidateData.email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "You have already applied for this position", code: "DUPLICATE" },
        { status: 409 }
      );
    }

    // Create candidate
    const { data: candidate, error: insertError } = await supabase
      .from("candidates")
      .insert({
        ...candidateData,
        stage: "applied",
        applied_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create application", code: "INSERT_FAILED" },
        { status: 500 }
      );
    }

    // Trigger AI scoring in the background (don't await to avoid blocking response)
    // The scoring will update the candidate record asynchronously
    processAndScoreCandidate({
      id: candidate.id,
      job_id: candidate.job_id,
      full_name: candidate.full_name,
      email: candidate.email,
      github_url: candidate.github_url,
      linkedin_url: candidate.linkedin_url,
      cover_letter: candidate.cover_letter,
      resume_text: candidate.resume_text,
    }).catch((error) => {
      console.error("Background AI scoring failed:", error);
    });

    return NextResponse.json(candidate, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/candidates:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
