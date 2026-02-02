import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RescheduleInterviewRequestSchema } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/interviews/[id]
 * Fetch interview details by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: interview, error } = await supabase
      .from("ai_interviews")
      .select(
        `
        *,
        candidates:candidate_id (
          id,
          full_name,
          email,
          phone,
          linkedin_url,
          github_url,
          ai_score
        ),
        jobs:job_id (
          id,
          title,
          department,
          level,
          location
        ),
        interview_questions (
          id,
          question_text,
          question_context,
          category,
          difficulty,
          question_order,
          estimated_time_minutes,
          candidate_answer,
          answered_at,
          time_spent_seconds,
          ai_score,
          ai_feedback
        )
      `
      )
      .eq("id", id)
      .single();

    if (error || !interview) {
      return NextResponse.json(
        {
          error: "Interview not found",
          code: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ interview });
  } catch (error) {
    console.error("Get interview error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/interviews/[id]
 * Update interview (reschedule, update status, etc.)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const supabase = await createClient();

    // Fetch current interview
    const { data: currentInterview, error: fetchError } = await supabase
      .from("ai_interviews")
      .select("*, candidates:candidate_id(email, full_name)")
      .eq("id", id)
      .single();

    if (fetchError || !currentInterview) {
      return NextResponse.json(
        {
          error: "Interview not found",
          code: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Check if this is a reschedule request
    if (body.scheduled_at) {
      const validation = RescheduleInterviewRequestSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: "Invalid request body",
            code: "VALIDATION_ERROR",
            details: validation.error.flatten(),
          },
          { status: 400 }
        );
      }

      const { scheduled_at, send_notification, reschedule_reason } =
        validation.data;

      // Validate scheduled_at is in the future
      const scheduledDate = new Date(scheduled_at);
      if (scheduledDate <= new Date()) {
        return NextResponse.json(
          {
            error: "Scheduled time must be in the future",
            code: "INVALID_SCHEDULE_TIME",
          },
          { status: 400 }
        );
      }

      // Can only reschedule if interview hasn't started
      if (
        !["pending", "scheduled", "ready"].includes(currentInterview.status)
      ) {
        return NextResponse.json(
          {
            error: "Cannot reschedule an interview that has already started",
            code: "INVALID_STATUS",
          },
          { status: 400 }
        );
      }

      // Calculate new expiration (24 hours after new scheduled time)
      const expiresAt = new Date(scheduledDate);
      expiresAt.setHours(expiresAt.getHours() + 24);

      // Update the interview
      const { data: updatedInterview, error: updateError } = await supabase
        .from("ai_interviews")
        .update({
          scheduled_at: scheduled_at,
          expires_at: expiresAt.toISOString(),
          status: "scheduled", // Reset to scheduled if it was 'ready'
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        console.error("Failed to update interview:", updateError);
        return NextResponse.json(
          {
            error: "Failed to update interview",
            code: "DATABASE_ERROR",
          },
          { status: 500 }
        );
      }

      // Log activity
      await supabase.from("candidate_activities").insert({
        candidate_id: currentInterview.candidate_id,
        activity_type: "interview_rescheduled",
        metadata: {
          interview_id: id,
          old_scheduled_at: currentInterview.scheduled_at,
          new_scheduled_at: scheduled_at,
          reason: reschedule_reason,
        },
        notes: `Interview rescheduled to ${new Date(scheduled_at).toLocaleString()}`,
        is_internal: false,
      });

      // TODO: Send reschedule notification email
      if (send_notification) {
        console.log(
          `[TODO] Send reschedule email to ${currentInterview.candidates?.email}`
        );
      }

      return NextResponse.json({
        interview: updatedInterview,
        message: "Interview rescheduled successfully",
      });
    }

    // Handle general updates (status changes, etc.)
    const allowedFields = ["status", "custom_message", "candidate_timezone"];
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data: updatedInterview, error: updateError } = await supabase
      .from("ai_interviews")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update interview:", updateError);
      return NextResponse.json(
        {
          error: "Failed to update interview",
          code: "DATABASE_ERROR",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ interview: updatedInterview });
  } catch (error) {
    console.error("Update interview error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/interviews/[id]
 * Cancel a scheduled interview
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const sendNotification = searchParams.get("send_notification") !== "false";
    const cancellationReason =
      searchParams.get("reason") || "Interview cancelled by recruiter";

    // Fetch current interview
    const { data: currentInterview, error: fetchError } = await supabase
      .from("ai_interviews")
      .select("*, candidates:candidate_id(email, full_name)")
      .eq("id", id)
      .single();

    if (fetchError || !currentInterview) {
      return NextResponse.json(
        {
          error: "Interview not found",
          code: "NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Can only cancel if interview hasn't been completed
    if (["completed", "cancelled"].includes(currentInterview.status)) {
      return NextResponse.json(
        {
          error: `Cannot cancel an interview with status: ${currentInterview.status}`,
          code: "INVALID_STATUS",
        },
        { status: 400 }
      );
    }

    // Update status to cancelled
    const { data: cancelledInterview, error: updateError } = await supabase
      .from("ai_interviews")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to cancel interview:", updateError);
      return NextResponse.json(
        {
          error: "Failed to cancel interview",
          code: "DATABASE_ERROR",
        },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("candidate_activities").insert({
      candidate_id: currentInterview.candidate_id,
      activity_type: "interview_cancelled",
      metadata: {
        interview_id: id,
        reason: cancellationReason,
      },
      notes: `Interview cancelled: ${cancellationReason}`,
      is_internal: false,
    });

    // TODO: Send cancellation notification email
    if (sendNotification) {
      console.log(
        `[TODO] Send cancellation email to ${currentInterview.candidates?.email}`
      );
    }

    return NextResponse.json({
      interview: cancelledInterview,
      message: "Interview cancelled successfully",
    });
  } catch (error) {
    console.error("Cancel interview error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
