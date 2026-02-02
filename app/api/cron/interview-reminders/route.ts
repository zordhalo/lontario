import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  sendInterviewReminderEmail,
  sendBatchEmails,
  type EmailType,
} from "@/lib/email";
import type { EmailTemplateData } from "@/lib/email/templates";

/**
 * GET /api/cron/interview-reminders
 * 
 * Cron job to send interview reminder emails
 * - 24-hour reminder: Sent day before scheduled time
 * - 1-hour reminder: Sent 1 hour before scheduled time
 * 
 * Should run every 15 minutes via Vercel Cron
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // In production, verify the cron secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();

    // Calculate time windows
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const oneHour15FromNow = new Date(now.getTime() + 75 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const twentyFourHours15FromNow = new Date(now.getTime() + 24.25 * 60 * 60 * 1000);

    // Fetch interviews needing 24-hour reminder
    const { data: interviews24h, error: error24h } = await supabase
      .from("ai_interviews")
      .select(`
        id,
        scheduled_at,
        interview_link,
        interview_duration_minutes,
        reminder_sent_at,
        candidates:candidate_id (
          email,
          full_name
        ),
        jobs:job_id (
          title
        )
      `)
      .in("status", ["scheduled", "ready"])
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", twentyFourHoursFromNow.toISOString())
      .lt("scheduled_at", twentyFourHours15FromNow.toISOString())
      .is("reminder_sent_at", null);

    if (error24h) {
      console.error("Error fetching 24h interviews:", error24h);
    }

    // Fetch interviews needing 1-hour reminder
    const { data: interviews1h, error: error1h } = await supabase
      .from("ai_interviews")
      .select(`
        id,
        scheduled_at,
        interview_link,
        interview_duration_minutes,
        reminder_sent_at,
        candidates:candidate_id (
          email,
          full_name
        ),
        jobs:job_id (
          title
        )
      `)
      .in("status", ["scheduled", "ready"])
      .not("scheduled_at", "is", null)
      .gte("scheduled_at", oneHourFromNow.toISOString())
      .lt("scheduled_at", oneHour15FromNow.toISOString());

    if (error1h) {
      console.error("Error fetching 1h interviews:", error1h);
    }

    // Prepare emails
    const emailsToSend: Array<{
      to: string;
      type: EmailType;
      data: EmailTemplateData;
      interviewId: string;
      reminderType: "24h" | "1h";
    }> = [];

    // Process 24-hour reminders
    if (interviews24h) {
      for (const interview of interviews24h) {
        const candidate = interview.candidates as any;
        const job = interview.jobs as any;

        if (!candidate?.email || !job?.title) continue;

        emailsToSend.push({
          to: candidate.email,
          type: "interview_reminder_24h",
          data: {
            candidateName: candidate.full_name || "Candidate",
            jobTitle: job.title,
            interviewLink: interview.interview_link || "",
            scheduledAt: interview.scheduled_at!,
            durationMinutes: interview.interview_duration_minutes || 30,
          },
          interviewId: interview.id,
          reminderType: "24h",
        });
      }
    }

    // Process 1-hour reminders
    if (interviews1h) {
      for (const interview of interviews1h) {
        const candidate = interview.candidates as any;
        const job = interview.jobs as any;

        if (!candidate?.email || !job?.title) continue;

        emailsToSend.push({
          to: candidate.email,
          type: "interview_reminder_1h",
          data: {
            candidateName: candidate.full_name || "Candidate",
            jobTitle: job.title,
            interviewLink: interview.interview_link || "",
            scheduledAt: interview.scheduled_at!,
            durationMinutes: interview.interview_duration_minutes || 30,
          },
          interviewId: interview.id,
          reminderType: "1h",
        });
      }
    }

    // Send emails
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const email of emailsToSend) {
      try {
        const result = await sendInterviewReminderEmail(
          email.to,
          email.data,
          email.reminderType === "24h" ? 24 : 1
        );

        if (result.success) {
          sentCount++;

          // Update reminder_sent_at for 24h reminders
          if (email.reminderType === "24h") {
            await supabase
              .from("ai_interviews")
              .update({ reminder_sent_at: now.toISOString() })
              .eq("id", email.interviewId);
          }
        } else {
          failedCount++;
          errors.push(`${email.to}: ${result.error}`);
        }
      } catch (err) {
        failedCount++;
        errors.push(`${email.to}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total_checked: (interviews24h?.length || 0) + (interviews1h?.length || 0),
        emails_sent: sentCount,
        emails_failed: failedCount,
        timestamp: now.toISOString(),
      },
      errors: errors.length > 0 ? errors : undefined,
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
