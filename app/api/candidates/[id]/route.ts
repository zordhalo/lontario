import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Validation schema for updates
const updateCandidateSchema = z.object({
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin_url: z.string().url().nullable().optional(),
  github_url: z.string().url().nullable().optional(),
  portfolio_url: z.string().url().nullable().optional(),
  is_starred: z.boolean().optional(),
  is_archived: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/candidates/[id]
 * Get a single candidate with full details (MVP: no auth required)
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // MVP: Auth disabled

    // Fetch candidate with job details
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select(`
        *,
        job:jobs!inner(id, title, required_skills)
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

    // Fetch activities
    const { data: activities } = await supabase
      .from("candidate_activities")
      .select("*")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false })
      .limit(20);

    // Fetch comments
    const { data: comments } = await supabase
      .from("candidate_comments")
      .select(`
        *,
        author:profiles!candidate_comments_author_id_fkey(id, full_name, avatar_url)
      `)
      .eq("candidate_id", id)
      .order("created_at", { ascending: false });

    // Fetch interview if exists
    const { data: interview } = await supabase
      .from("ai_interviews")
      .select("*")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      ...candidate,
      activities: activities || [],
      comments: comments || [],
      interview: interview || null,
    });
  } catch (error) {
    console.error("Unexpected error in GET /api/candidates/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/candidates/[id]
 * Update a candidate (MVP: no auth required)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // MVP: Auth disabled

    // Parse and validate request body
    const body = await req.json();
    const validation = updateCandidateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    // MVP: Skip job ownership check - verify candidate exists
    const { data: candidate } = await supabase
      .from("candidates")
      .select("id")
      .eq("id", id)
      .single();

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // Update candidate
    const { data: updated, error: updateError } = await supabase
      .from("candidates")
      .update({
        ...validation.data,
        last_activity_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update candidate", code: "UPDATE_FAILED" },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Unexpected error in PATCH /api/candidates/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/candidates/[id]
 * Delete a candidate (MVP: no auth required)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // MVP: Auth disabled - delete directly

    // Delete candidate
    const { error: deleteError } = await supabase
      .from("candidates")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete candidate", code: "DELETE_FAILED" },
        { status: 500 }
      );
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Unexpected error in DELETE /api/candidates/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
