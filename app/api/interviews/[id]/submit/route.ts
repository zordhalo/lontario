import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { evaluateAnswer } from "@/lib/ai/openai";
import { z } from "zod";
import type {
  SubmitInterviewResponse,
  InterviewRecommendation,
  QuestionCategory,
  ScoringCriteria,
} from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Schema for single answer submission
const SubmitAnswerSchema = z.object({
  question_id: z.string().uuid(),
  answer: z.string().min(1, "Answer cannot be empty"),
  time_spent_seconds: z.number().min(0),
});

// Schema for full interview submission
const SubmitInterviewSchema = z.object({
  token: z.string(),
  answers: z.array(SubmitAnswerSchema).min(1),
});

/**
 * POST /api/interviews/[id]/submit
 * Submit all answers for an interview
 *
 * This endpoint processes all answers, evaluates them with AI,
 * calculates the overall score, and completes the interview.
 * 
 * The [id] parameter can be either the interview ID or the access_token.
 * For public interview links, the access_token is used as the route param.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Validate request body
    const validation = SubmitInterviewSchema.safeParse(body);
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

    const { token, answers } = validation.data;

    // Use admin client since this is a public endpoint
    const supabase = createAdminClient();

    // Build query - support lookup by access_token (for public interview links)
    let query = supabase
      .from("ai_interviews")
      .select(
        `
        *,
        candidates:candidate_id (
          id,
          full_name,
          extracted_skills,
          resume_text
        ),
        jobs:job_id (
          id,
          title,
          level,
          description,
          required_skills
        )
      `
      );

    // If token matches id, look up by access_token (public interview link pattern)
    if (token === id) {
      query = query.eq("access_token", token);
    } else {
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
    
    // Use the actual interview ID for all subsequent operations
    const interviewId = interview.id;

    // Check if interview can accept submissions
    if (interview.status === "completed") {
      return NextResponse.json(
        {
          error: "Interview has already been completed",
          code: "ALREADY_COMPLETED",
        },
        { status: 400 }
      );
    }

    if (!["in_progress", "scheduled", "ready"].includes(interview.status)) {
      return NextResponse.json(
        {
          error: `Cannot submit answers for interview with status: ${interview.status}`,
          code: "INVALID_STATUS",
        },
        { status: 400 }
      );
    }

    // Check if interview has expired
    const now = new Date();
    if (now > new Date(interview.expires_at)) {
      await supabase
        .from("ai_interviews")
        .update({ status: "expired" })
        .eq("id", interviewId);

      return NextResponse.json(
        {
          error: "Interview has expired",
          code: "INTERVIEW_EXPIRED",
        },
        { status: 410 }
      );
    }

    // Fetch interview questions
    const { data: questions, error: questionsError } = await supabase
      .from("interview_questions")
      .select("*")
      .eq("interview_id", interviewId);

    if (questionsError || !questions) {
      return NextResponse.json(
        {
          error: "Failed to fetch interview questions",
          code: "DATABASE_ERROR",
        },
        { status: 500 }
      );
    }

    // Create a map of questions for quick lookup
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    // Build job context for AI evaluation
    const jobContext = `${interview.jobs?.title || "Role"} (${interview.jobs?.level || ""}): ${interview.jobs?.description?.slice(0, 500) || ""}`;
    const candidateBackground = `${interview.candidates?.full_name || "Candidate"} - Skills: ${(interview.candidates?.extracted_skills || []).join(", ")}`;

    // Process each answer
    const evaluationResults: Array<{
      question_id: string;
      score: number;
      feedback: string;
    }> = [];

    for (const answer of answers) {
      const question = questionMap.get(answer.question_id);
      if (!question) {
        console.warn(`Question not found: ${answer.question_id}`);
        continue;
      }

      // Evaluate the answer using AI
      let evaluation;
      try {
        evaluation = await evaluateAnswer(
          {
            text: question.question_text,
            category: question.category as QuestionCategory,
            scoring_rubric: (question.scoring_rubric as ScoringCriteria[]) || [],
          },
          answer.answer,
          jobContext,
          candidateBackground
        );
      } catch (aiError) {
        console.error(
          `Failed to evaluate answer for question ${answer.question_id}:`,
          aiError
        );
        // Provide a default evaluation if AI fails
        evaluation = {
          score: 5,
          feedback: "Unable to evaluate - answer recorded",
          breakdown: [],
        };
      }

      evaluationResults.push({
        question_id: answer.question_id,
        score: evaluation.score,
        feedback: evaluation.feedback,
      });

      // Update the question with the answer and evaluation
      await supabase
        .from("interview_questions")
        .update({
          candidate_answer: answer.answer,
          answered_at: now.toISOString(),
          time_spent_seconds: answer.time_spent_seconds,
          ai_score: evaluation.score,
          ai_feedback: evaluation.feedback,
          ai_evaluation_breakdown: evaluation.breakdown,
        })
        .eq("id", answer.question_id);
    }

    // Calculate overall score (average of all question scores, scaled to 100)
    const totalScore = evaluationResults.reduce((sum, r) => sum + r.score, 0);
    const averageScore = totalScore / evaluationResults.length;
    const overallScore = Math.round(averageScore * 10); // Scale 0-10 to 0-100

    // Determine recommendation based on score
    let recommendation: InterviewRecommendation;
    if (overallScore >= 85) {
      recommendation = "strong_yes";
    } else if (overallScore >= 70) {
      recommendation = "yes";
    } else if (overallScore >= 55) {
      recommendation = "maybe";
    } else if (overallScore >= 40) {
      recommendation = "no";
    } else {
      recommendation = "strong_no";
    }

    // Generate summary of strengths and concerns
    const strengths: string[] = [];
    const concerns: string[] = [];

    for (const result of evaluationResults) {
      if (result.score >= 7) {
        strengths.push(result.feedback.split(".")[0] || "Strong performance");
      } else if (result.score <= 4) {
        concerns.push(result.feedback.split(".")[0] || "Needs improvement");
      }
    }

    // Generate AI summary
    const aiSummary = `Candidate completed the interview with an overall score of ${overallScore}%. ${
      strengths.length > 0
        ? `Strengths include: ${strengths.slice(0, 3).join("; ")}.`
        : ""
    } ${
      concerns.length > 0
        ? `Areas for improvement: ${concerns.slice(0, 3).join("; ")}.`
        : ""
    }`;

    // Update interview with final results
    const { error: updateError } = await supabase
      .from("ai_interviews")
      .update({
        status: "completed",
        completed_at: now.toISOString(),
        questions_answered: answers.length,
        overall_score: overallScore,
        ai_summary: aiSummary,
        strengths: strengths.slice(0, 5),
        concerns: concerns.slice(0, 5),
        recommendation,
        updated_at: now.toISOString(),
      })
      .eq("id", interviewId);

    if (updateError) {
      console.error("Failed to complete interview:", updateError);
      return NextResponse.json(
        {
          error: "Failed to save interview results",
          code: "DATABASE_ERROR",
        },
        { status: 500 }
      );
    }

    // Update candidate's last activity (preserve original AI match analysis)
    // Interview results are stored on ai_interviews table, not overwritten on candidate
    await supabase
      .from("candidates")
      .update({
        last_activity_at: now.toISOString(),
      })
      .eq("id", interview.candidate_id);

    // Log activity
    await supabase.from("candidate_activities").insert({
      candidate_id: interview.candidate_id,
      activity_type: "interview_completed",
      metadata: {
        interview_id: interviewId,
        overall_score: overallScore,
        questions_answered: answers.length,
        recommendation,
      },
      notes: `Completed AI interview with score: ${overallScore}%`,
      is_internal: false,
    });

    const response: SubmitInterviewResponse = {
      interview_id: interviewId,
      status: "completed",
      overall_score: overallScore,
      summary: aiSummary,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Submit interview error:", error);
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
 * PATCH /api/interviews/[id]/submit
 * Submit a single answer (for real-time saving)
 * 
 * The [id] parameter can be either the interview ID or the access_token.
 * For public interview links, the access_token is used as the route param.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();

    const { token, question_id, answer, time_spent_seconds } = body;

    if (!token || !question_id || !answer) {
      return NextResponse.json(
        {
          error: "Missing required fields",
          code: "VALIDATION_ERROR",
        },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Build query - support lookup by access_token (for public interview links)
    let query = supabase
      .from("ai_interviews")
      .select("id, status, candidate_id");

    // If token matches id, look up by access_token (public interview link pattern)
    if (token === id) {
      query = query.eq("access_token", token);
    } else {
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

    // Use the actual interview ID for all subsequent operations
    const interviewId = interview.id;

    if (!["in_progress", "scheduled", "ready"].includes(interview.status)) {
      return NextResponse.json(
        {
          error: `Cannot save answer for interview with status: ${interview.status}`,
          code: "INVALID_STATUS",
        },
        { status: 400 }
      );
    }

    // Update the question with the answer
    const now = new Date();
    const { error: updateError } = await supabase
      .from("interview_questions")
      .update({
        candidate_answer: answer,
        answered_at: now.toISOString(),
        time_spent_seconds: time_spent_seconds || 0,
      })
      .eq("id", question_id)
      .eq("interview_id", interviewId);

    if (updateError) {
      console.error("Failed to save answer:", updateError);
      return NextResponse.json(
        {
          error: "Failed to save answer",
          code: "DATABASE_ERROR",
        },
        { status: 500 }
      );
    }

    // Update questions_answered count
    const { count } = await supabase
      .from("interview_questions")
      .select("id", { count: "exact" })
      .eq("interview_id", interviewId)
      .not("candidate_answer", "is", null);

    await supabase
      .from("ai_interviews")
      .update({
        questions_answered: count || 0,
        updated_at: now.toISOString(),
      })
      .eq("id", interviewId);

    return NextResponse.json({
      success: true,
      question_id,
      saved_at: now.toISOString(),
    });
  } catch (error) {
    console.error("Save answer error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
      { status: 500 }
    );
  }
}
