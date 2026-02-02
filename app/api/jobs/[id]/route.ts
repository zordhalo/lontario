import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Validation schema for updates
const updateJobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  level: z.enum(["junior", "mid", "senior", "staff", "principal"]).optional(),
  department: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  location_type: z.enum(["remote", "onsite", "hybrid"]).optional(),
  employment_type: z
    .enum(["full-time", "part-time", "contract", "internship"])
    .optional(),
  description: z.string().min(50).optional(),
  required_skills: z.array(z.string()).optional(),
  nice_to_have_skills: z.array(z.string()).optional(),
  salary_min: z.number().positive().nullable().optional(),
  salary_max: z.number().positive().nullable().optional(),
  show_salary: z.boolean().optional(),
  status: z.enum(["draft", "active", "paused", "closed"]).optional(),
  is_archived: z.boolean().optional(),
  application_deadline: z.string().datetime().nullable().optional(),
  screening_questions: z.array(z.unknown()).optional(),
  require_cover_letter: z.boolean().optional(),
  require_linkedin: z.boolean().optional(),
  require_github: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/jobs/[id]
 * Get a single job with candidate summary (MVP: no auth required)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // MVP: Auth disabled

    // Fetch job
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Fetch candidate summary
    const { data: candidates, error: candidatesError } = await supabase
      .from("candidates")
      .select("id, full_name, ai_score, stage, applied_at")
      .eq("job_id", id)
      .order("ai_score", { ascending: false, nullsFirst: false });

    if (candidatesError) {
      console.error("Error fetching candidates:", candidatesError);
    }

    // Calculate stage counts
    const byStage: Record<string, number> = {};
    const topCandidates =
      candidates
        ?.filter((c) => c.ai_score && c.ai_score >= 80)
        .slice(0, 5) || [];

    candidates?.forEach((c) => {
      byStage[c.stage] = (byStage[c.stage] || 0) + 1;
    });

    // Count recent applications (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentApplications =
      candidates?.filter(
        (c) => new Date(c.applied_at) > sevenDaysAgo
      ).length || 0;

    return NextResponse.json({
      ...job,
      candidate_summary: {
        by_stage: byStage,
        top_candidates: topCandidates,
        recent_applications: recentApplications,
      },
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/jobs/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/jobs/[id]
 * Update a job (MVP: no auth required)
 */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // MVP: Auth disabled

    // Parse and validate request body
    const body = await req.json();
    const validation = updateJobSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = { ...validation.data };

    // Handle status changes
    if (validation.data.status === "active") {
      updateData.published_at = new Date().toISOString();
    } else if (validation.data.status === "closed") {
      updateData.closed_at = new Date().toISOString();
    }

    // Update job
    const { data: job, error: updateError } = await supabase
      .from("jobs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update job", code: "UPDATE_FAILED" },
        { status: 500 }
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: "Job not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error("Unexpected error in PUT /api/jobs/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/jobs/[id]
 * Delete a job (MVP: no auth required)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // MVP: Auth disabled

    // Delete job (cascades to candidates)
    const { error: deleteError } = await supabase
      .from("jobs")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete job", code: "DELETE_FAILED" },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/jobs/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
