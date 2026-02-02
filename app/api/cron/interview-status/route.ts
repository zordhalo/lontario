import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/cron/interview-status
 * 
 * Cron job to update interview statuses based on time
 * - Mark "scheduled" as "ready" when scheduled time has passed
 * - Mark "ready" as "missed" if 2+ hours past scheduled time without starting
 * - Mark "in_progress" as "abandoned" if no activity for 2+ hours
 * - Mark interviews as "expired" when expiration time has passed
 * 
 * Should run every 5 minutes via Vercel Cron
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const updates = {
      scheduled_to_ready: 0,
      ready_to_missed: 0,
      in_progress_to_abandoned: 0,
      expired: 0,
    };

    // 1. Mark "scheduled" interviews as "ready" when time has arrived
    const { data: scheduledInterviews, error: scheduledError } = await supabase
      .from("ai_interviews")
      .select("id")
      .eq("status", "scheduled")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", now.toISOString());

    if (scheduledError) {
      console.error("Error fetching scheduled interviews:", scheduledError);
    } else if (scheduledInterviews && scheduledInterviews.length > 0) {
      const ids = scheduledInterviews.map((i) => i.id);
      const { error: updateError } = await supabase
        .from("ai_interviews")
        .update({ status: "ready", updated_at: now.toISOString() })
        .in("id", ids);

      if (!updateError) {
        updates.scheduled_to_ready = ids.length;
      } else {
        console.error("Error updating scheduled to ready:", updateError);
      }
    }

    // 2. Mark "ready" interviews as "missed" if 2+ hours past scheduled time
    const { data: readyInterviews, error: readyError } = await supabase
      .from("ai_interviews")
      .select("id, candidate_id")
      .eq("status", "ready")
      .not("scheduled_at", "is", null)
      .lte("scheduled_at", twoHoursAgo.toISOString());

    if (readyError) {
      console.error("Error fetching ready interviews:", readyError);
    } else if (readyInterviews && readyInterviews.length > 0) {
      const ids = readyInterviews.map((i) => i.id);
      const { error: updateError } = await supabase
        .from("ai_interviews")
        .update({ status: "missed", updated_at: now.toISOString() })
        .in("id", ids);

      if (!updateError) {
        updates.ready_to_missed = ids.length;

        // Log activity for missed interviews
        for (const interview of readyInterviews) {
          await supabase.from("candidate_activities").insert({
            candidate_id: interview.candidate_id,
            activity_type: "interview_missed",
            metadata: { interview_id: interview.id },
            notes: "Candidate did not start the interview within the allowed window",
            is_internal: false,
          });
        }
      } else {
        console.error("Error updating ready to missed:", updateError);
      }
    }

    // 3. Mark "in_progress" interviews as "abandoned" if no update for 2+ hours
    const { data: inProgressInterviews, error: inProgressError } = await supabase
      .from("ai_interviews")
      .select("id, candidate_id")
      .eq("status", "in_progress")
      .lte("updated_at", twoHoursAgo.toISOString());

    if (inProgressError) {
      console.error("Error fetching in_progress interviews:", inProgressError);
    } else if (inProgressInterviews && inProgressInterviews.length > 0) {
      const ids = inProgressInterviews.map((i) => i.id);
      const { error: updateError } = await supabase
        .from("ai_interviews")
        .update({ status: "abandoned", updated_at: now.toISOString() })
        .in("id", ids);

      if (!updateError) {
        updates.in_progress_to_abandoned = ids.length;

        // Log activity for abandoned interviews
        for (const interview of inProgressInterviews) {
          await supabase.from("candidate_activities").insert({
            candidate_id: interview.candidate_id,
            activity_type: "interview_abandoned",
            metadata: { interview_id: interview.id },
            notes: "Interview was abandoned due to inactivity",
            is_internal: false,
          });
        }
      } else {
        console.error("Error updating in_progress to abandoned:", updateError);
      }
    }

    // 4. Mark interviews as "expired" when expiration time has passed
    const { data: expiredInterviews, error: expiredError } = await supabase
      .from("ai_interviews")
      .select("id, candidate_id")
      .in("status", ["scheduled", "ready", "pending"])
      .lte("expires_at", now.toISOString());

    if (expiredError) {
      console.error("Error fetching expired interviews:", expiredError);
    } else if (expiredInterviews && expiredInterviews.length > 0) {
      const ids = expiredInterviews.map((i) => i.id);
      const { error: updateError } = await supabase
        .from("ai_interviews")
        .update({ status: "expired", updated_at: now.toISOString() })
        .in("id", ids);

      if (!updateError) {
        updates.expired = ids.length;
      } else {
        console.error("Error updating to expired:", updateError);
      }
    }

    const totalUpdated = Object.values(updates).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      success: true,
      summary: {
        total_updated: totalUpdated,
        ...updates,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
