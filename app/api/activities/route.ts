import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Validation schema for query parameters
const listActivitiesSchema = z.object({
  limit: z.coerce.number().min(1).max(50).default(10),
  job_id: z.string().uuid().optional(),
});

/**
 * GET /api/activities
 * List recent activities across all candidates (MVP: no auth required)
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Parse and validate query parameters
    const searchParams = Object.fromEntries(req.nextUrl.searchParams);
    const validation = listActivitiesSchema.safeParse(searchParams);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid query parameters",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { limit, job_id } = validation.data;

    // Build query to fetch activities with candidate info
    let query = supabase
      .from("candidate_activities")
      .select(`
        id,
        candidate_id,
        activity_type,
        metadata,
        old_value,
        new_value,
        notes,
        created_at,
        candidate:candidates!inner(
          id,
          full_name,
          email,
          job_id
        )
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter by job if specified
    if (job_id) {
      query = query.eq("candidate.job_id", job_id);
    }

    const { data: activities, error: dbError } = await query;

    if (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Failed to fetch activities", code: "DB_ERROR" },
        { status: 500 }
      );
    }

    // Transform activities into a more usable format
    const formattedActivities = (activities || []).map((activity) => {
      const candidate = activity.candidate as { id: string; full_name: string; email: string; job_id: string } | null;
      
      // Generate a human-readable message based on activity type
      let message = "";
      const candidateName = candidate?.full_name || "Unknown";
      
      switch (activity.activity_type) {
        case "application_submitted":
          message = `${candidateName} submitted an application`;
          break;
        case "stage_changed":
          message = `${candidateName} moved to ${activity.new_value || "new stage"}`;
          break;
        case "ai_scored":
          message = `AI scored ${candidateName} ${activity.new_value || ""}% match`;
          break;
        case "interview_scheduled":
          message = `Interview scheduled with ${candidateName}`;
          break;
        case "interview_completed":
          message = `${candidateName} completed AI interview`;
          break;
        case "resume_parsed":
          message = `Resume parsed for ${candidateName}`;
          break;
        case "starred":
          message = `${candidateName} was starred`;
          break;
        case "unstarred":
          message = `${candidateName} was unstarred`;
          break;
        case "comment_added":
          message = `Comment added on ${candidateName}`;
          break;
        default:
          message = `Activity on ${candidateName}`;
      }

      return {
        id: activity.id,
        type: activity.activity_type,
        message,
        timestamp: activity.created_at,
        candidateId: activity.candidate_id,
        candidateName: candidate?.full_name || null,
        metadata: activity.metadata,
      };
    });

    return NextResponse.json({
      activities: formattedActivities,
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/activities:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
