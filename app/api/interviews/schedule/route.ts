import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInterviewQuestions } from "@/lib/ai/openai";
import { getAppUrl } from "@/lib/utils";
import {
  ScheduleInterviewRequestSchema,
  ScheduleInterviewResponse,
  JobDescription,
  CandidateProfile,
  GeneratedQuestion,
  PregeneratedQuestions,
} from "@/types";

/**
 * POST /api/interviews/schedule
 * Schedule an AI interview for a candidate
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = ScheduleInterviewRequestSchema.safeParse(body);
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

    const {
      candidate_id,
      job_id,
      scheduled_at,
      duration_minutes,
      send_immediate_invite,
      custom_message,
      candidate_timezone,
    } = validation.data;

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

    const supabase = await createClient();

    // Fetch candidate with job details
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidate_id)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        {
          error: "Candidate not found",
          code: "CANDIDATE_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        {
          error: "Job not found",
          code: "JOB_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // Check if candidate already has a scheduled/in-progress interview for this job
    const { data: existingInterview } = await supabase
      .from("ai_interviews")
      .select("id, status")
      .eq("candidate_id", candidate_id)
      .eq("job_id", job_id)
      .in("status", ["scheduled", "ready", "in_progress"])
      .single();

    if (existingInterview) {
      return NextResponse.json(
        {
          error: "Candidate already has an active interview for this job",
          code: "INTERVIEW_EXISTS",
          details: {
            interview_id: existingInterview.id,
            status: existingInterview.status,
          },
        },
        { status: 409 }
      );
    }

    // Generate unique access token
    const accessToken = crypto.randomUUID();

    // Build interview link
    const baseUrl = getAppUrl();
    const interviewLink = `${baseUrl}/interview/${accessToken}`;

    // Calculate expiration (24 hours after scheduled time)
    const expiresAt = new Date(scheduledDate);
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Try to use pre-generated questions first (instant scheduling!)
    let questionSet: { questions: GeneratedQuestion[]; totalEstimatedTime: number } | null = null;
    let usedPregeneratedId: string | null = null;

    const { data: pregeneratedQuestions } = await supabase
      .from("pregenerated_questions")
      .select("*")
      .eq("candidate_id", candidate_id)
      .eq("job_id", job_id)
      .eq("status", "ready")
      .single();

    if (pregeneratedQuestions && pregeneratedQuestions.questions?.length > 0) {
      // Use pre-generated questions - this is instant!
      console.log(`Using pre-generated questions for candidate ${candidate_id}`);
      questionSet = {
        questions: pregeneratedQuestions.questions as GeneratedQuestion[],
        totalEstimatedTime: pregeneratedQuestions.total_estimated_time,
      };
      usedPregeneratedId = pregeneratedQuestions.id;
    } else {
      // Fall back to generating questions on-demand (slower path)
      console.log(`No pre-generated questions available, generating on-demand for candidate ${candidate_id}`);
      
      // Prepare data for question generation
      const jobDescription: JobDescription = {
        title: job.title,
        level: job.level || "mid",
        description: job.description,
        requiredSkills: job.required_skills || [],
        niceToHave: job.nice_to_have_skills || [],
      };

      // Build candidate profile from available data
      const candidateProfile: CandidateProfile = {
        source: candidate.github_url
          ? "github"
          : candidate.linkedin_url
            ? "linkedin"
            : "resume",
        name: candidate.full_name,
        url: candidate.github_url || candidate.linkedin_url || undefined,
        bio: candidate.ai_summary || undefined,
        skills: candidate.extracted_skills || [],
        experience: candidate.resume_text
          ? [candidate.resume_text.slice(0, 500)]
          : [],
      };

      // Generate interview questions
      try {
        const generatedSet = await generateInterviewQuestions(
          jobDescription,
          candidateProfile
        );
        questionSet = {
          questions: generatedSet.questions,
          totalEstimatedTime: generatedSet.totalEstimatedTime,
        };
      } catch (aiError) {
        console.error("Failed to generate questions:", aiError);
        return NextResponse.json(
          {
            error: "Failed to generate interview questions",
            code: "AI_GENERATION_ERROR",
          },
          { status: 500 }
        );
      }
    }

    // Create the AI interview record
    const { data: interview, error: interviewError } = await supabase
      .from("ai_interviews")
      .insert({
        candidate_id,
        job_id,
        model_used: "gpt-4o-2024-08-06",
        total_questions: questionSet.questions.length,
        status: "scheduled",
        questions_answered: 0,
        access_token: accessToken,
        expires_at: expiresAt.toISOString(),
        scheduled_at: scheduled_at,
        interview_link: interviewLink,
        interview_duration_minutes: duration_minutes,
        candidate_timezone: candidate_timezone || null,
        custom_message: custom_message || null,
      })
      .select()
      .single();

    if (interviewError || !interview) {
      console.error("Failed to create interview:", interviewError);
      return NextResponse.json(
        {
          error: "Failed to create interview",
          code: "DATABASE_ERROR",
        },
        { status: 500 }
      );
    }

    // Insert the generated questions into interview_questions table
    const questionsToInsert = questionSet.questions.map(
      (q: GeneratedQuestion, index: number) => ({
        interview_id: interview.id,
        question_text: q.question,
        question_context: q.context,
        category: q.category,
        difficulty: q.difficulty,
        question_order: index + 1,
        estimated_time_minutes: q.estimatedTime,
        scoring_rubric: q.scoringRubric,
      })
    );

    const { error: questionsError } = await supabase
      .from("interview_questions")
      .insert(questionsToInsert);

    if (questionsError) {
      console.error("Failed to insert questions:", questionsError);
      // Don't fail the whole operation, questions can be regenerated
    }

    // Mark pre-generated questions as used (if we used them)
    if (usedPregeneratedId) {
      await supabase
        .from("pregenerated_questions")
        .update({
          status: "used",
          used_at: new Date().toISOString(),
          used_in_interview_id: interview.id,
        })
        .eq("id", usedPregeneratedId);

      // Update candidate's question generation status
      await supabase
        .from("candidates")
        .update({ question_generation_status: "none" })
        .eq("id", candidate_id);
    }

    // Log activity
    await supabase.from("candidate_activities").insert({
      candidate_id,
      activity_type: "interview_scheduled",
      metadata: {
        interview_id: interview.id,
        scheduled_at,
        duration_minutes,
      },
      notes: `AI Interview scheduled for ${new Date(scheduled_at).toLocaleString()}`,
      is_internal: false,
    });

    // Update candidate stage if currently in earlier stage
    const stageOrder = [
      "applied",
      "screening",
      "ai_interview",
      "phone_screen",
      "technical",
      "onsite",
      "offer",
      "hired",
    ];
    const currentStageIndex = stageOrder.indexOf(candidate.stage);
    const aiInterviewIndex = stageOrder.indexOf("ai_interview");

    if (currentStageIndex < aiInterviewIndex) {
      await supabase
        .from("candidates")
        .update({
          stage: "ai_interview",
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", candidate_id);
    }

    // TODO: Send email notification if send_immediate_invite is true
    // This will be implemented in the email-system todo
    if (send_immediate_invite) {
      console.log(
        `[TODO] Send invite email to ${candidate.email} for interview at ${scheduled_at}`
      );
    }

    const response: ScheduleInterviewResponse = {
      interview: interview,
      interview_link: interviewLink,
      questions_generated: questionSet.questions.length,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Schedule interview error:", error);
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
 * GET /api/interviews/schedule
 * List upcoming scheduled interviews
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const jobId = searchParams.get("job_id");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("ai_interviews")
      .select(
        `
        *,
        candidates:candidate_id (
          id,
          full_name,
          email
        ),
        jobs:job_id (
          id,
          title,
          department
        )
      `
      )
      .not("scheduled_at", "is", null)
      .order("scheduled_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (jobId) {
      query = query.eq("job_id", jobId);
    }

    if (status) {
      query = query.eq("status", status);
    } else {
      // Default: show upcoming and active interviews
      query = query.in("status", [
        "scheduled",
        "ready",
        "in_progress",
        "completed",
      ]);
    }

    const { data: interviews, error, count } = await query;

    if (error) {
      console.error("Failed to fetch interviews:", error);
      return NextResponse.json(
        {
          error: "Failed to fetch interviews",
          code: "DATABASE_ERROR",
        },
        { status: 500 }
      );
    }

    // Transform the response to match the expected type
    // Supabase returns `candidates` and `jobs` (plural) from the join aliases,
    // but the frontend expects `candidate` and `job` (singular)
    const transformedInterviews = (interviews || []).map((interview) => {
      const { candidates, jobs, ...rest } = interview as Record<string, unknown>;
      return {
        ...rest,
        candidate: candidates || null,
        job: jobs || null,
      };
    });

    return NextResponse.json({
      interviews: transformedInterviews,
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error("List interviews error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
