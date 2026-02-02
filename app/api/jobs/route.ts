import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { z } from "zod";
import { generateJobDescription } from "@/lib/ai";

// Validation schemas
const createJobSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  level: z.enum(["junior", "mid", "senior", "staff", "principal"]).optional(),
  department: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  location_type: z.enum(["remote", "onsite", "hybrid"]).optional(),
  employment_type: z
    .enum(["full-time", "part-time", "contract", "internship"])
    .optional(),
  description: z.string().min(50, "Description must be at least 50 characters"),
  required_skills: z.array(z.string()).min(1, "At least one skill required"),
  nice_to_have_skills: z.array(z.string()).optional().default([]),
  salary_min: z.number().positive().optional(),
  salary_max: z.number().positive().optional(),
  use_ai_description: z.boolean().optional().default(false),
  status: z.enum(["draft", "active"]).optional().default("draft"),
});

const listJobsSchema = z.object({
  status: z.enum(["draft", "active", "paused", "closed"]).optional(),
  include_archived: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sort: z.enum(["created_at", "updated_at", "title"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * GET /api/jobs
 * List all jobs (MVP: no auth required)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // MVP: Auth disabled - all jobs accessible

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const validation = listJobsSchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { status, include_archived, page, limit, sort, order } = validation.data;
    const offset = (page - 1) * limit;

    // Build query - MVP: no user filter
    let query = supabase
      .from("jobs")
      .select("*", { count: "exact" })
      .order(sort, { ascending: order === "asc" })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    // Filter out archived jobs by default
    if (!include_archived) {
      query = query.eq("is_archived", false);
    }

    const { data: jobs, error: dbError, count } = await query;

    if (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Failed to fetch jobs", code: "DB_ERROR" },
        { status: 500 }
      );
    }

    // Fetch candidate stage counts for all jobs
    const jobIds = jobs?.map((j) => j.id) || [];
    let stageCounts: Record<string, Record<string, number>> = {};

    if (jobIds.length > 0) {
      const { data: candidates, error: candidatesError } = await supabase
        .from("candidates")
        .select("job_id, stage")
        .in("job_id", jobIds);

      if (candidatesError) {
        console.error("Error fetching candidate stages:", candidatesError);
        // Continue without stage counts rather than failing
      } else if (candidates) {
        // Aggregate candidates by job_id and stage
        stageCounts = candidates.reduce((acc, candidate) => {
          const jobId = candidate.job_id;
          const stage = candidate.stage;
          if (!acc[jobId]) {
            acc[jobId] = {};
          }
          acc[jobId][stage] = (acc[jobId][stage] || 0) + 1;
          return acc;
        }, {} as Record<string, Record<string, number>>);
      }
    }

    // Merge stage counts into job objects
    const jobsWithStageCounts = jobs?.map((job) => ({
      ...job,
      stage_counts: stageCounts[job.id] || {},
    }));

    return NextResponse.json({
      jobs: jobsWithStageCounts,
      pagination: {
        total: count ?? 0,
        page,
        limit,
        pages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/jobs:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

// MVP placeholder user ID (used when auth is disabled)
const MVP_USER_ID = "00000000-0000-0000-0000-000000000000";

// Ensure MVP placeholder profile exists
async function ensureMvpProfile(supabase: ReturnType<typeof createAdminClient>) {
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: MVP_USER_ID,
        email: "mvp@placeholder.local",
        full_name: "MVP User",
        role: "recruiter",
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("Failed to ensure MVP profile:", error);
    throw new Error("Failed to create MVP profile for job creation");
  }
}

/**
 * POST /api/jobs
 * Create a new job posting (MVP: no auth required)
 */
export async function POST(req: NextRequest) {
  try {
    // MVP: Use admin client to bypass RLS (no auth required)
    const supabase = createAdminClient();

    // Ensure MVP placeholder profile exists for foreign key constraint
    await ensureMvpProfile(supabase);

    // Parse and validate request body
    const body = await req.json();
    const validation = createJobSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const jobData = validation.data;
    let description = jobData.description;

    // Generate AI description if requested
    if (jobData.use_ai_description) {
      try {
        description = await generateJobDescription({
          title: jobData.title,
          level: jobData.level,
          required_skills: jobData.required_skills,
          base_description: jobData.description,
          department: jobData.department,
          location: jobData.location,
        });
      } catch (aiError) {
        console.error("AI description generation failed:", aiError);
        // Fall back to original description
      }
    }

    // Insert job
    const { data: job, error: insertError } = await supabase
      .from("jobs")
      .insert({
        created_by: MVP_USER_ID,
        title: jobData.title,
        level: jobData.level,
        department: jobData.department,
        location: jobData.location,
        location_type: jobData.location_type,
        employment_type: jobData.employment_type,
        description,
        required_skills: jobData.required_skills,
        nice_to_have_skills: jobData.nice_to_have_skills,
        salary_min: jobData.salary_min,
        salary_max: jobData.salary_max,
        ai_generated_description: jobData.use_ai_description,
        status: jobData.status,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to create job", code: "INSERT_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    console.error("Unexpected error in POST /api/jobs:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
