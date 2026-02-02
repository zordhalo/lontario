import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { CandidateStage } from "@/types";

// Validation schema
const moveCandidateSchema = z.object({
  stage: z.enum([
    "applied",
    "screening",
    "ai_interview",
    "phone_screen",
    "technical",
    "onsite",
    "offer",
    "hired",
    "rejected",
  ]),
  rejection_reason: z.string().optional(),
  rejection_feedback: z.string().optional(),
  notes: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// MVP placeholder user ID (used when auth is disabled)
const MVP_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * POST /api/candidates/[id]/move
 * Move a candidate to a new stage (MVP: no auth required)
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // MVP: Auth disabled

    // Parse and validate request body
    const body = await req.json();
    const validation = moveCandidateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { stage, rejection_reason, rejection_feedback, notes } = validation.data;

    // Require rejection reason if rejecting
    if (stage === "rejected" && !rejection_reason) {
      return NextResponse.json(
        { error: "Rejection reason is required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Fetch candidate
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select(`
        id,
        stage,
        full_name,
        job:jobs!inner(id, title)
      `)
      .eq("id", id)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: "Candidate not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // MVP: Skip job ownership check

    const oldStage = candidate.stage as CandidateStage;

    // Update candidate stage
    const updateData: Record<string, unknown> = {
      stage,
      last_activity_at: new Date().toISOString(),
    };

    if (stage === "rejected") {
      updateData.rejection_reason = rejection_reason;
      updateData.rejection_feedback = rejection_feedback;
    }

    const { data: updated, error: updateError } = await supabase
      .from("candidates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to move candidate", code: "UPDATE_FAILED" },
        { status: 500 }
      );
    }

    // Create activity record
    const { data: activity, error: activityError } = await supabase
      .from("candidate_activities")
      .insert({
        candidate_id: id,
        performed_by: MVP_USER_ID,
        activity_type: stage === "rejected" ? "rejected" : "stage_changed",
        old_value: oldStage,
        new_value: stage,
        notes,
        metadata: {
          job_title: candidate.job.title,
          rejection_reason,
        },
      })
      .select()
      .single();

    if (activityError) {
      console.error("Activity error:", activityError);
      // Don't fail the request, activity logging is secondary
    }

    return NextResponse.json({
      candidate: updated,
      activity: activity || null,
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/candidates/[id]/move:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
