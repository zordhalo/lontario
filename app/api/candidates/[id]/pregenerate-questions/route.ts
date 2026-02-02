import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInterviewQuestions } from "@/lib/ai/openai";
import {
  JobDescription,
  CandidateProfile,
  GeneratedQuestion,
} from "@/types";

/**
 * POST /api/candidates/[id]/pregenerate-questions
 * Trigger pre-generation of interview questions for a candidate
 * This runs in the background after a candidate is added to a job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: candidateId } = await params;
    const supabase = await createClient();

    // Fetch candidate
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("*")
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: "Candidate not found", code: "CANDIDATE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Fetch job details
    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", candidate.job_id)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: "Job not found", code: "JOB_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Check if questions already exist and are ready
    const { data: existingQuestions } = await supabase
      .from("pregenerated_questions")
      .select("id, status")
      .eq("candidate_id", candidateId)
      .eq("job_id", candidate.job_id)
      .single();

    if (existingQuestions) {
      if (existingQuestions.status === "ready") {
        return NextResponse.json({
          message: "Questions already pre-generated",
          status: "ready",
          pregenerated_questions_id: existingQuestions.id,
        });
      }
      
      if (existingQuestions.status === "generating") {
        return NextResponse.json({
          message: "Question generation already in progress",
          status: "generating",
          pregenerated_questions_id: existingQuestions.id,
        });
      }
    }

    // Create or update pregenerated_questions record to 'generating' status
    const { data: pregeneratedRecord, error: upsertError } = await supabase
      .from("pregenerated_questions")
      .upsert(
        {
          candidate_id: candidateId,
          job_id: candidate.job_id,
          status: "generating",
          questions: [],
          total_questions: 0,
          total_estimated_time: 0,
        },
        {
          onConflict: "candidate_id,job_id",
        }
      )
      .select()
      .single();

    if (upsertError) {
      console.error("Failed to create pregenerated_questions record:", upsertError);
      return NextResponse.json(
        { error: "Failed to start question generation", code: "DATABASE_ERROR" },
        { status: 500 }
      );
    }

    // Update candidate status
    await supabase
      .from("candidates")
      .update({ question_generation_status: "generating" })
      .eq("id", candidateId);

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
      const questionSet = await generateInterviewQuestions(
        jobDescription,
        candidateProfile
      );

      // Update the record with generated questions
      const { error: updateError } = await supabase
        .from("pregenerated_questions")
        .update({
          questions: questionSet.questions,
          total_questions: questionSet.questions.length,
          total_estimated_time: questionSet.totalEstimatedTime,
          status: "ready",
          generated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", pregeneratedRecord.id);

      if (updateError) {
        console.error("Failed to update pregenerated questions:", updateError);
        throw new Error("Failed to save generated questions");
      }

      // Update candidate status to ready
      await supabase
        .from("candidates")
        .update({ question_generation_status: "ready" })
        .eq("id", candidateId);

      return NextResponse.json({
        message: "Questions pre-generated successfully",
        status: "ready",
        pregenerated_questions_id: pregeneratedRecord.id,
        questions_generated: questionSet.questions.length,
        total_estimated_time: questionSet.totalEstimatedTime,
      });
    } catch (aiError) {
      console.error("Failed to generate questions:", aiError);

      // Update record with failure status
      await supabase
        .from("pregenerated_questions")
        .update({
          status: "failed",
          error_message:
            aiError instanceof Error ? aiError.message : "AI generation failed",
        })
        .eq("id", pregeneratedRecord.id);

      // Update candidate status
      await supabase
        .from("candidates")
        .update({ question_generation_status: "failed" })
        .eq("id", candidateId);

      return NextResponse.json(
        {
          error: "Failed to generate interview questions",
          code: "AI_GENERATION_ERROR",
          details: aiError instanceof Error ? aiError.message : undefined,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Pregenerate questions error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/candidates/[id]/pregenerate-questions
 * Check the status of pre-generated questions for a candidate
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: candidateId } = await params;
    const supabase = await createClient();

    // Fetch candidate to get job_id
    const { data: candidate, error: candidateError } = await supabase
      .from("candidates")
      .select("job_id, question_generation_status")
      .eq("id", candidateId)
      .single();

    if (candidateError || !candidate) {
      return NextResponse.json(
        { error: "Candidate not found", code: "CANDIDATE_NOT_FOUND" },
        { status: 404 }
      );
    }

    // Fetch pregenerated questions
    const { data: pregeneratedQuestions, error: questionsError } = await supabase
      .from("pregenerated_questions")
      .select("*")
      .eq("candidate_id", candidateId)
      .eq("job_id", candidate.job_id)
      .single();

    if (questionsError || !pregeneratedQuestions) {
      return NextResponse.json({
        status: "none",
        message: "No pre-generated questions found",
        candidate_status: candidate.question_generation_status,
      });
    }

    return NextResponse.json({
      status: pregeneratedQuestions.status,
      pregenerated_questions_id: pregeneratedQuestions.id,
      total_questions: pregeneratedQuestions.total_questions,
      total_estimated_time: pregeneratedQuestions.total_estimated_time,
      generated_at: pregeneratedQuestions.generated_at,
      error_message: pregeneratedQuestions.error_message,
      used_at: pregeneratedQuestions.used_at,
      used_in_interview_id: pregeneratedQuestions.used_in_interview_id,
    });
  } catch (error) {
    console.error("Get pregenerated questions error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
