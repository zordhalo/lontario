import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/interviews/:id/review
 * Mark an interview summary as reviewed
 * 
 * This endpoint is called when a recruiter views a completed interview summary.
 * It sets the reviewed_at timestamp, which removes the interview from the
 * "Needs Your Attention" alerts on the dashboard.
 * 
 * MVP: No authentication required. In production, reviewed_by would be set
 * to the authenticated user's ID.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Interview ID is required", code: "MISSING_ID" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // First, check if the interview exists and is completed
    const { data: interview, error: fetchError } = await supabase
      .from("ai_interviews")
      .select("id, status, reviewed_at")
      .eq("id", id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Interview not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }
      console.error("Error fetching interview:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch interview", code: "FETCH_ERROR" },
        { status: 500 }
      );
    }

    // Only completed interviews can be marked as reviewed
    if (interview.status !== "completed") {
      return NextResponse.json(
        { 
          error: "Only completed interviews can be marked as reviewed", 
          code: "INVALID_STATUS",
          current_status: interview.status
        },
        { status: 400 }
      );
    }

    // If already reviewed, return success without updating
    if (interview.reviewed_at) {
      return NextResponse.json({
        interview_id: id,
        reviewed_at: interview.reviewed_at,
        already_reviewed: true,
      });
    }

    // Mark as reviewed
    const now = new Date().toISOString();
    const { data: updatedInterview, error: updateError } = await supabase
      .from("ai_interviews")
      .update({
        reviewed_at: now,
        // reviewed_by: userId, // TODO: Add when auth is implemented
        updated_at: now,
      })
      .eq("id", id)
      .select("id, reviewed_at")
      .single();

    if (updateError) {
      console.error("Error marking interview as reviewed:", updateError);
      return NextResponse.json(
        { error: "Failed to mark interview as reviewed", code: "UPDATE_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      interview_id: updatedInterview.id,
      reviewed_at: updatedInterview.reviewed_at,
      already_reviewed: false,
    });
  } catch (error) {
    console.error("Unexpected error in POST /api/interviews/:id/review:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/interviews/:id/review
 * Unmark an interview as reviewed (mark as needing attention again)
 * 
 * Useful if a recruiter wants to revisit an interview later
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Interview ID is required", code: "MISSING_ID" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data: updatedInterview, error: updateError } = await supabase
      .from("ai_interviews")
      .update({
        reviewed_at: null,
        reviewed_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, reviewed_at")
      .single();

    if (updateError) {
      if (updateError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Interview not found", code: "NOT_FOUND" },
          { status: 404 }
        );
      }
      console.error("Error unmarking interview as reviewed:", updateError);
      return NextResponse.json(
        { error: "Failed to unmark interview as reviewed", code: "UPDATE_ERROR" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      interview_id: updatedInterview.id,
      reviewed_at: null,
    });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/interviews/:id/review:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
