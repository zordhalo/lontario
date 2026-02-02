import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface StatWithTrend {
  value: number;
  trend: number;
}

interface DashboardStats {
  active_jobs: StatWithTrend;
  new_applications: StatWithTrend;
  ai_matches_today: StatWithTrend;
  hired_this_week: StatWithTrend;
}

/**
 * GET /api/dashboard/stats
 * Get aggregated dashboard statistics (MVP: no auth required)
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get current date boundaries
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // 1. Active Jobs count (exclude archived jobs)
    const { count: activeJobsCount, error: activeJobsError } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .eq("is_archived", false);

    if (activeJobsError) {
      console.error("Error fetching active jobs:", activeJobsError);
    }

    // Get active jobs from last week for trend (exclude archived)
    const { count: activeJobsLastWeek } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .eq("is_archived", false)
      .lt("created_at", weekAgo.toISOString());

    // 2. New Applications (last 7 days)
    const { count: newApplicationsCount, error: newAppsError } = await supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .gte("applied_at", weekAgo.toISOString());

    if (newAppsError) {
      console.error("Error fetching new applications:", newAppsError);
    }

    // Applications from previous week for trend
    const { count: applicationsLastWeek } = await supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .gte("applied_at", twoWeeksAgo.toISOString())
      .lt("applied_at", weekAgo.toISOString());

    // 3. AI Matches Today (candidates with ai_score >= 80 scored today)
    const { count: aiMatchesTodayCount, error: aiMatchesError } = await supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .gte("ai_score", 80)
      .gte("updated_at", today.toISOString());

    if (aiMatchesError) {
      console.error("Error fetching AI matches:", aiMatchesError);
    }

    // AI matches from yesterday for trend
    const { count: aiMatchesYesterday } = await supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .gte("ai_score", 80)
      .gte("updated_at", yesterday.toISOString())
      .lt("updated_at", today.toISOString());

    // 4. Hired This Week
    const { count: hiredThisWeekCount, error: hiredError } = await supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("stage", "hired")
      .gte("updated_at", weekAgo.toISOString());

    if (hiredError) {
      console.error("Error fetching hired count:", hiredError);
    }

    // Hired last week for trend
    const { count: hiredLastWeek } = await supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("stage", "hired")
      .gte("updated_at", twoWeeksAgo.toISOString())
      .lt("updated_at", weekAgo.toISOString());

    // Calculate trends (percentage change)
    const calculateTrend = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const stats: DashboardStats = {
      active_jobs: {
        value: activeJobsCount ?? 0,
        trend: calculateTrend(activeJobsCount ?? 0, activeJobsLastWeek ?? 0),
      },
      new_applications: {
        value: newApplicationsCount ?? 0,
        trend: calculateTrend(newApplicationsCount ?? 0, applicationsLastWeek ?? 0),
      },
      ai_matches_today: {
        value: aiMatchesTodayCount ?? 0,
        trend: calculateTrend(aiMatchesTodayCount ?? 0, aiMatchesYesterday ?? 0),
      },
      hired_this_week: {
        value: hiredThisWeekCount ?? 0,
        trend: calculateTrend(hiredThisWeekCount ?? 0, hiredLastWeek ?? 0),
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Unexpected error in GET /api/dashboard/stats:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
