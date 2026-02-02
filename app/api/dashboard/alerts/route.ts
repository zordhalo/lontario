import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface DashboardAlert {
  id: string;
  type: "high_score" | "pending_interview" | "review_ready";
  title: string;
  href: string;
  count: number;
}

/**
 * GET /api/dashboard/alerts
 * Get actionable alerts for the dashboard (MVP: no auth required)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const alerts: DashboardAlert[] = [];

    // 1. High-scoring candidates (ai_score >= 90) in 'applied' stage per job
    const { data: highScoreCandidates, error: highScoreError } = await supabase
      .from("candidates")
      .select(`
        job_id,
        job:jobs!inner(id, title)
      `)
      .gte("ai_score", 90)
      .eq("stage", "applied")
      .eq("is_archived", false);

    if (highScoreError) {
      console.error("Error fetching high score candidates:", highScoreError);
    }

    // Group by job and create alerts
    if (highScoreCandidates && highScoreCandidates.length > 0) {
      const jobCounts: Record<string, { title: string; count: number }> = {};
      
      highScoreCandidates.forEach((candidate) => {
        const job = candidate.job as { id: string; title: string } | null;
        if (job) {
          if (!jobCounts[job.id]) {
            jobCounts[job.id] = { title: job.title, count: 0 };
          }
          jobCounts[job.id].count++;
        }
      });

      // Create an alert for each job with high-scoring candidates
      Object.entries(jobCounts).forEach(([jobId, { title, count }]) => {
        alerts.push({
          id: `high_score_${jobId}`,
          type: "high_score",
          title: `${count} candidate${count > 1 ? "s" : ""} scored 90%+ for ${title}`,
          href: `/jobs/${jobId}`,
          count,
        });
      });
    }

    // 2. Interviews pending schedule (status = 'pending')
    const { count: pendingInterviewsCount, error: pendingError } = await supabase
      .from("ai_interviews")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "scheduled"])
      .is("started_at", null);

    if (pendingError) {
      console.error("Error fetching pending interviews:", pendingError);
    }

    if (pendingInterviewsCount && pendingInterviewsCount > 0) {
      alerts.push({
        id: "pending_interviews",
        type: "pending_interview",
        title: `${pendingInterviewsCount} interview${pendingInterviewsCount > 1 ? "s" : ""} pending schedule`,
        href: "/jobs",
        count: pendingInterviewsCount,
      });
    }

    // 3. Completed AI interviews ready for review (not yet reviewed)
    const { count: completedInterviewsCount, error: completedError } = await supabase
      .from("ai_interviews")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .is("reviewed_at", null);

    if (completedError) {
      console.error("Error fetching completed interviews:", completedError);
    }

    if (completedInterviewsCount && completedInterviewsCount > 0) {
      alerts.push({
        id: "review_ready",
        type: "review_ready",
        title: `${completedInterviewsCount} AI interview summar${completedInterviewsCount > 1 ? "ies" : "y"} ready for review`,
        href: "/jobs",
        count: completedInterviewsCount,
      });
    }

    // Sort alerts by count (most urgent first)
    alerts.sort((a, b) => b.count - a.count);

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error("Unexpected error in GET /api/dashboard/alerts:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
