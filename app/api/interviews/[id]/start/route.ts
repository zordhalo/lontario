import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { StartInterviewResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/interviews/[id]/start
 * Candidate starts their interview (validates token and time)
 *
 * This endpoint is used by the public interview page.
 * Authentication is via the access_token, not user session.
 * 
 * The [id] parameter can be either the interview ID or the access_token.
 * For public interview links, the access_token is used as the route param.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { token, force_start } = body;

    if (!token) {
      return NextResponse.json(
        {
          error: "Access token is required",
          code: "TOKEN_REQUIRED",
        },
        { status: 400 }
      );
    }

    // Use admin client since this is a public endpoint (no user session)
    const supabase = createAdminClient();

    // Build query - support lookup by access_token (for public interview links)
    let query = supabase
      .from("ai_interviews")
      .select(
        `
        *,
        jobs:job_id (
          id,
          title,
          company_name:created_by,
          level
        )
      `
      );

    // If token matches id, look up by access_token (public interview link pattern)
    // Otherwise, look up by interview ID with token validation
    if (token === id) {
      // Public interview link: /interview/[access_token] calls /api/interviews/[access_token]/start
      query = query.eq("access_token", token);
    } else {
      // Admin/internal: lookup by ID with token validation
      query = query.eq("id", id).eq("access_token", token);
    }

    const { data: interview, error: fetchError } = await query.single();

    if (fetchError || !interview) {
      return NextResponse.json(
        {
          error: "Invalid interview or access token",
          code: "INVALID_TOKEN",
        },
        { status: 401 }
      );
    }

    const now = new Date();
    const scheduledAt = interview.scheduled_at
      ? new Date(interview.scheduled_at)
      : null;
    const expiresAt = new Date(interview.expires_at);

    // Use the actual interview ID for all subsequent operations
    const interviewId = interview.id;

    // Check if interview has expired
    if (now > expiresAt) {
      // Update status to expired if not already
      if (interview.status !== "expired") {
        await supabase
          .from("ai_interviews")
          .update({ status: "expired" })
          .eq("id", interviewId);
      }

      return NextResponse.json(
        {
          error: "This interview has expired",
          code: "INTERVIEW_EXPIRED",
        },
        { status: 410 }
      );
    }

    // Check if interview is already completed or cancelled
    if (["completed", "cancelled", "expired"].includes(interview.status)) {
      return NextResponse.json(
        {
          error: `Interview is ${interview.status}`,
          code: "INVALID_STATUS",
          details: { status: interview.status },
        },
        { status: 400 }
      );
    }

    // Check if interview is already in progress
    if (interview.status === "in_progress") {
      // Allow resuming - fetch questions and return
      const { data: questions } = await supabase
        .from("interview_questions")
        .select("*")
        .eq("interview_id", interviewId)
        .order("question_order", { ascending: true });

      const response: StartInterviewResponse = {
        interview_id: interviewId,
        questions: questions || [],
        total_duration_minutes: interview.interview_duration_minutes || 30,
        expires_at: interview.expires_at,
      };

      return NextResponse.json(response);
    }

    // Check if it's too early (before scheduled time minus 5 minute grace period)
    // Skip this check if force_start is true (allows manual start before scheduled time)
    if (scheduledAt && !force_start) {
      const graceperiod = 5 * 60 * 1000; // 5 minutes in milliseconds
      const canStartAt = new Date(scheduledAt.getTime() - graceperiod);

      if (now < canStartAt) {
        const minutesUntilStart = Math.ceil(
          (scheduledAt.getTime() - now.getTime()) / (1000 * 60)
        );

        return NextResponse.json(
          {
            error: "Interview has not started yet",
            code: "TOO_EARLY",
            details: {
              scheduled_at: interview.scheduled_at,
              minutes_until_start: minutesUntilStart,
              can_start_at: canStartAt.toISOString(),
            },
          },
          { status: 425 } // Too Early status code
        );
      }
    }

    // Update interview status to in_progress
    const { error: updateError } = await supabase
      .from("ai_interviews")
      .update({
        status: "in_progress",
        started_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", interviewId);

    if (updateError) {
      console.error("Failed to start interview:", updateError);
      return NextResponse.json(
        {
          error: "Failed to start interview",
          code: "DATABASE_ERROR",
        },
        { status: 500 }
      );
    }

    // Fetch interview questions
    const { data: questions, error: questionsError } = await supabase
      .from("interview_questions")
      .select("*")
      .eq("interview_id", interviewId)
      .order("question_order", { ascending: true });

    if (questionsError) {
      console.error("Failed to fetch questions:", questionsError);
      return NextResponse.json(
        {
          error: "Failed to fetch interview questions",
          code: "DATABASE_ERROR",
        },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("candidate_activities").insert({
      candidate_id: interview.candidate_id,
      activity_type: "interview_started",
      metadata: {
        interview_id: interviewId,
        started_at: now.toISOString(),
      },
      notes: "Candidate started the AI interview",
      is_internal: false,
    });

    const response: StartInterviewResponse = {
      interview_id: interviewId,
      questions: questions || [],
      total_duration_minutes: interview.interview_duration_minutes || 30,
      expires_at: interview.expires_at,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Start interview error:", error);
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
 * GET /api/interviews/[id]/start
 * Check interview status and availability (for pre-flight check)
 * 
 * The [id] parameter can be either the interview ID or the access_token.
 * If a token query param is provided, we validate both match.
 * If no token query param is provided, we look up by access_token only (for public interview links).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    const supabase = createAdminClient();

    // Build query - support lookup by access_token (for public interview links)
    // The URL /interview/[token] passes the access_token as both the route param and query param
    let query = supabase
      .from("ai_interviews")
      .select(
        `
        id,
        status,
        scheduled_at,
        expires_at,
        interview_duration_minutes,
        total_questions,
        questions_answered,
        started_at,
        jobs:job_id (
          id,
          title,
          level
        )
      `
      );

    // If token is provided and matches id, look up by access_token (public interview link pattern)
    // Otherwise, look up by interview ID with token validation
    if (token && token === id) {
      // Public interview link: /interview/[access_token] calls /api/interviews/[access_token]/start?token=[access_token]
      query = query.eq("access_token", token);
    } else if (token) {
      // Admin/internal: lookup by ID with token validation
      query = query.eq("id", id).eq("access_token", token);
    } else {
      // No token provided - try lookup by access_token first (most common for candidate access)
      query = query.eq("access_token", id);
    }

    const { data: interview, error: fetchError } = await query.single();

    if (fetchError || !interview) {
      return NextResponse.json(
        {
          error: "Invalid interview or access token",
          code: "INVALID_TOKEN",
        },
        { status: 401 }
      );
    }

    const now = new Date();
    const scheduledAt = interview.scheduled_at
      ? new Date(interview.scheduled_at)
      : null;
    const expiresAt = new Date(interview.expires_at);

    // Determine if interview can be started
    let canStart = true;
    let reason = null;
    let timeInfo: Record<string, unknown> = {};

    if (now > expiresAt) {
      canStart = false;
      reason = "Interview has expired";
    } else if (["completed", "cancelled", "expired"].includes(interview.status)) {
      canStart = false;
      reason = `Interview is ${interview.status}`;
    } else if (scheduledAt) {
      const graceperiod = 5 * 60 * 1000; // 5 minutes
      const canStartAt = new Date(scheduledAt.getTime() - graceperiod);

      if (now < canStartAt) {
        canStart = false;
        reason = "Interview has not started yet";
        timeInfo = {
          scheduled_at: interview.scheduled_at,
          minutes_until_start: Math.ceil(
            (scheduledAt.getTime() - now.getTime()) / (1000 * 60)
          ),
          can_start_at: canStartAt.toISOString(),
        };
      }
    }

    return NextResponse.json({
      interview_id: interview.id,
      status: interview.status,
      can_start: canStart,
      reason,
      job: interview.jobs,
      duration_minutes: interview.interview_duration_minutes,
      total_questions: interview.total_questions,
      questions_answered: interview.questions_answered,
      ...timeInfo,
    });
  } catch (error) {
    console.error("Check interview status error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
