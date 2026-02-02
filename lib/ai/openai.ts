/**
 * @fileoverview OpenAI integration for AI-powered hiring features
 * 
 * This module provides functions for all AI operations in the platform:
 * - Interview question generation (personalized to candidate/job)
 * - Follow-up question generation
 * - Candidate-job matching/scoring
 * - Resume parsing
 * - Answer evaluation
 * - Job description generation
 * 
 * All functions use OpenAI's structured outputs (zodResponseFormat) for
 * type-safe, validated responses.
 * 
 * @module lib/ai/openai
 * @requires OPENAI_API_KEY environment variable
 */

import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import {
  JobDescription,
  CandidateProfile,
  QuestionSetSchema,
  QuestionSet,
  FollowUpResponseSchema,
  FollowUpResponse,
  GeneratedQuestion,
  MatchScoreSchema,
  MatchScore,
  ParsedResumeSchema,
  ParsedResume,
  AnswerEvaluationSchema,
  AnswerEvaluation,
  QuestionCategory,
  ScoringCriteria,
} from "@/types";

// ============================================================
// CLIENT INITIALIZATION
// ============================================================

/** Singleton OpenAI client instance */
let openaiClient: OpenAI | null = null;

/**
 * Gets or creates the OpenAI client instance
 * Uses lazy initialization to avoid build-time errors when env vars aren't set
 * 
 * @returns OpenAI client instance
 * @throws Error if OPENAI_API_KEY is not configured
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Default AI model configuration
 * Uses GPT-4o with structured outputs for reliable JSON responses
 */
export const AI_CONFIG = {
  /** Model version with structured output support */
  model: "gpt-4o-2024-08-06",
  /** Creativity level (0 = deterministic, 1 = creative) */
  temperature: 0.7,
  /** Maximum tokens in response */
  maxTokens: 4096,
} as const;

/**
 * Simple rate limiter to prevent API quota exhaustion
 * Ensures minimum interval between API calls
 */
const rateLimiter = {
  lastCall: 0,
  minInterval: 100, // ms between calls

  /**
   * Waits if needed to respect rate limits
   * Should be called before each API request
   */
  async wait() {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    if (elapsed < this.minInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minInterval - elapsed)
      );
    }
    this.lastCall = Date.now();
  },
};

// ============================================================
// INTERVIEW QUESTION GENERATION
// ============================================================

/**
 * System prompt for question generation
 * Instructs GPT to act as an expert technical recruiter
 */
const QUESTION_SYSTEM_PROMPT = `You are an expert technical recruiter and interviewer with 15+ years of experience at FAANG companies.

Your task is to generate highly targeted, personalized interview questions that:
1. Match the job requirements exactly
2. Leverage the candidate's specific background (projects, skills, experience)
3. Test both technical depth and behavioral fit
4. Progress from warm-up to challenging questions
5. Include clear, actionable scoring rubrics

CRITICAL RULES:
- Generate EXACTLY 8-10 questions total
- Questions must reference specific details from the candidate's profile
- Each question must have a multi-dimensional scoring rubric
- Balance technical (60%) and behavioral (40%) questions
- Difficulty should ladder: 2-3 easy, 4-5 medium, 2-3 hard
- Every question must have clear "excellent/good/needs work" criteria

QUESTION CATEGORIES:
- technical: Coding challenges, algorithm design, language-specific questions
- behavioral: Leadership, teamwork, conflict resolution, past experiences
- system-design: Architecture decisions, scalability, trade-offs
- problem-solving: Debugging scenarios, optimization challenges
- culture-fit: Values alignment, collaboration style

OUTPUT FORMAT:
- Use structured JSON matching the schema
- Group questions logically by category
- Provide context explaining WHY each question matters for THIS candidate`;

/**
 * Builds the user prompt for question generation with job and candidate context
 * 
 * @param job - Job description with requirements
 * @param candidate - Candidate profile with skills and experience
 * @returns Formatted prompt string for GPT
 */
function buildQuestionPrompt(
  job: JobDescription,
  candidate: CandidateProfile
): string {
  // Calculate matching and missing skills
  const candidateSkillsLower = candidate.skills.map((s) => s.toLowerCase());
  const matchingSkills = job.requiredSkills.filter((skill) =>
    candidateSkillsLower.includes(skill.toLowerCase())
  );
  const skillGaps = job.requiredSkills.filter(
    (skill) => !candidateSkillsLower.includes(skill.toLowerCase())
  );

  // Format projects for the prompt
  const projectsText = candidate.projects
    ? candidate.projects
        .slice(0, 5)
        .map(
          (p) =>
            `- ${p.name} (${p.language}, ${p.stars} stars): ${p.description || "No description"}`
        )
        .join("\n")
    : "No public projects available";

  return `JOB DETAILS:
- Title: ${job.title}
- Level: ${job.level}
- Required Skills: ${job.requiredSkills.join(", ")}
- Nice-to-Have: ${job.niceToHave.join(", ") || "None specified"}
- Description: ${job.description}

CANDIDATE PROFILE:
- Name: ${candidate.name}
- Source: ${candidate.source}
- Bio: ${candidate.bio || "Not provided"}
- Skills: ${candidate.skills.join(", ")}
- Experience: 
${candidate.experience.map((e) => `  - ${e}`).join("\n")}
- Notable Projects:
${projectsText}

ANALYSIS:
- Matching Skills: ${matchingSkills.length > 0 ? matchingSkills.join(", ") : "None directly matching"}
- Skill Gaps to Probe: ${skillGaps.length > 0 ? skillGaps.join(", ") : "All required skills present"}

INSTRUCTIONS:
Generate 8-10 interview questions that:
1. Start with 2-3 warm-up questions about their specific projects/experience
2. Include 3-4 deep technical questions on required skills
3. Add 2-3 behavioral questions relevant to ${job.level} level
4. End with 1-2 challenging questions testing system thinking

For each question:
- Reference specific details from their profile
- Explain why this question matters for the role
- Provide a 3-tier scoring rubric with concrete examples
- Assign realistic time estimates (5-15 minutes per question)`;
}

/**
 * Generates personalized interview questions for a candidate
 * 
 * Questions are tailored to:
 * - The specific job requirements and level
 * - The candidate's skills, projects, and experience
 * - Progressive difficulty (warm-up → technical → challenging)
 * 
 * @param job - Job description with requirements and level
 * @param candidate - Candidate profile with skills and background
 * @returns QuestionSet with 6-10 personalized questions grouped by category
 * 
 * @throws Error if OpenAI API fails or returns invalid response
 * 
 * @example
 * const questions = await generateInterviewQuestions(
 *   { title: "Senior Engineer", level: "senior", requiredSkills: ["React", "TypeScript"], ... },
 *   { name: "Jane Doe", skills: ["React", "Node.js"], projects: [...], ... }
 * );
 */
export async function generateInterviewQuestions(
  job: JobDescription,
  candidate: CandidateProfile
): Promise<QuestionSet> {
  await rateLimiter.wait();
  const openai = getOpenAIClient();

  const completion = await openai.beta.chat.completions.parse({
    model: AI_CONFIG.model,
    messages: [
      { role: "system", content: QUESTION_SYSTEM_PROMPT },
      { role: "user", content: buildQuestionPrompt(job, candidate) },
    ],
    response_format: zodResponseFormat(QuestionSetSchema, "interview_questions"),
    temperature: AI_CONFIG.temperature,
  });

  const questionSet = completion.choices[0].message.parsed;

  if (!questionSet) {
    throw new Error("Failed to generate questions: No response from OpenAI");
  }

  // Group questions by category
  const groupedByCategory: Record<QuestionCategory, GeneratedQuestion[]> = {
    technical: [],
    behavioral: [],
    "system-design": [],
    "problem-solving": [],
    "culture-fit": [],
  };

  questionSet.questions.forEach((q) => {
    if (groupedByCategory[q.category]) {
      groupedByCategory[q.category].push(q);
    }
  });

  return {
    ...questionSet,
    groupedByCategory,
  };
}

// ============================================================
// FOLLOW-UP QUESTION GENERATION
// ============================================================

/**
 * System prompt for follow-up question generation
 * Creates probing questions based on candidate's answer
 */
const FOLLOW_UP_SYSTEM_PROMPT = `You are conducting a technical interview. Your role is to generate intelligent follow-up questions that probe deeper into the candidate's understanding.

Generate follow-up questions that:
1. Probe deeper into a specific aspect they mentioned
2. Test understanding beyond surface-level knowledge
3. Reveal how they think through edge cases or trade-offs
4. Are natural and conversational (not confrontational)`;

/**
 * Generates an intelligent follow-up question based on candidate's answer
 * 
 * Useful for:
 * - Probing deeper into vague answers
 * - Testing edge case understanding
 * - Revealing thought process on trade-offs
 * 
 * @param originalQuestion - The question that was answered
 * @param candidateAnswer - The candidate's response text
 * @param job - Job context for relevance
 * @returns FollowUpResponse with question and rationale
 * 
 * @example
 * const followUp = await generateFollowUpQuestion(
 *   question,
 *   "I would use a microservices architecture...",
 *   jobDescription
 * );
 * // followUp.followUp: "How would you handle data consistency across those microservices?"
 * // followUp.rationale: "Tests understanding of distributed systems challenges"
 */
export async function generateFollowUpQuestion(
  originalQuestion: GeneratedQuestion,
  candidateAnswer: string,
  job: JobDescription
): Promise<FollowUpResponse> {
  await rateLimiter.wait();
  const openai = getOpenAIClient();

  const userPrompt = `ORIGINAL QUESTION: ${originalQuestion.question}

CANDIDATE'S ANSWER: ${candidateAnswer}

JOB CONTEXT: 
- Title: ${job.title}
- Level: ${job.level}
- Key Requirements: ${job.requiredSkills.slice(0, 5).join(", ")}

Based on the candidate's answer, generate ONE intelligent follow-up question that probes deeper into their understanding or reveals how they handle edge cases.`;

  const completion = await openai.beta.chat.completions.parse({
    model: AI_CONFIG.model,
    messages: [
      { role: "system", content: FOLLOW_UP_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: zodResponseFormat(FollowUpResponseSchema, "follow_up"),
    temperature: AI_CONFIG.temperature,
  });

  const followUp = completion.choices[0].message.parsed;

  if (!followUp) {
    throw new Error("Failed to generate follow-up question");
  }

  return followUp;
}

// ============================================================
// CANDIDATE SCORING
// ============================================================

/**
 * System prompt for candidate-job scoring
 * Provides scoring guidelines and weighting factors
 */
const SCORING_SYSTEM_PROMPT = `You are an expert technical recruiter evaluating candidate-job fit.

SCORING GUIDELINES:
- 90-100: Exceptional match, exceeds requirements
- 75-89: Strong match, meets most requirements
- 60-74: Moderate match, some gaps but trainable
- 40-59: Weak match, significant gaps
- 0-39: Poor match, does not meet basic requirements

FACTORS TO CONSIDER:
1. Skills Match (40% weight): Direct skill overlap with required skills
2. Experience Match (30% weight): Years and relevance of experience
3. Education Match (15% weight): Relevant degree/certifications
4. Keywords Match (15% weight): Industry terminology, specific tools

BE BALANCED: Acknowledge both strengths and concerns. Provide actionable insights.`;

/**
 * Scores a candidate against a job's requirements
 * 
 * Provides a comprehensive match analysis including:
 * - Overall score (0-100)
 * - Category breakdown (skills, experience, education, keywords)
 * - Skill gap analysis (matched, missing, bonus)
 * - Strengths and concerns
 * - Hiring recommendation
 * 
 * @param candidate - Candidate data including skills, experience, resume
 * @param job - Job requirements including title, level, skills
 * @returns MatchScore with detailed breakdown and recommendation
 * 
 * @example
 * const score = await scoreCandidate(
 *   { skills: ["React", "TypeScript"], experience: ["3 years at startup"], resume_text: "..." },
 *   { title: "Senior Engineer", level: "senior", required_skills: ["React", "Node.js"], ... }
 * );
 * // score.overall_score: 78
 * // score.recommendation: "yes"
 */
export async function scoreCandidate(
  candidate: {
    skills: string[];
    experience: string[];
    resume_text: string;
    years_of_experience?: number;
    education_level?: string;
  },
  job: {
    title: string;
    level: string;
    required_skills: string[];
    nice_to_have_skills?: string[];
    description: string;
  }
): Promise<MatchScore> {
  await rateLimiter.wait();
  const openai = getOpenAIClient();

  const userPrompt = `
JOB REQUIREMENTS:
- Title: ${job.title}
- Level: ${job.level}
- Required Skills: ${job.required_skills.join(", ")}
- Nice-to-Have: ${job.nice_to_have_skills?.join(", ") || "None specified"}
- Description: ${job.description}

CANDIDATE PROFILE:
- Experience: ${candidate.years_of_experience || "Unknown"} years
- Skills: ${candidate.skills.join(", ")}
- Education: ${candidate.education_level || "Unknown"}
- Experience Highlights:
${candidate.experience.slice(0, 5).map((e) => `  - ${e}`).join("\n")}

RESUME EXCERPT:
${candidate.resume_text.slice(0, 2000)}

Evaluate this candidate's fit for the role.`;

  const completion = await openai.beta.chat.completions.parse({
    model: AI_CONFIG.model,
    messages: [
      { role: "system", content: SCORING_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: zodResponseFormat(MatchScoreSchema, "match_score"),
    temperature: 0.5,
  });

  const matchScore = completion.choices[0].message.parsed;

  if (!matchScore) {
    throw new Error("Failed to score candidate");
  }

  return matchScore;
}

// ============================================================
// RESUME PARSING
// ============================================================

/**
 * System prompt for resume parsing
 * Extracts structured data from unstructured resume text
 */
const RESUME_SYSTEM_PROMPT = `You are an expert resume parser. Extract structured information from resumes with high accuracy.

RULES:
1. Extract ALL skills mentioned (technical, soft skills, tools, frameworks)
2. Calculate years of experience from work history
3. Preserve original wording for job titles and companies
4. If information is not present, omit the field
5. For dates, use format "YYYY-MM" or "Present"
6. Extract achievements and metrics from experience descriptions

Be thorough and precise. Missing information is better than guessed information.`;

/**
 * Parses unstructured resume text into structured data
 * 
 * Extracts:
 * - Contact information (name, email, phone, location)
 * - Professional URLs (LinkedIn, GitHub)
 * - Skills (technical, soft, tools)
 * - Work experience with highlights
 * - Education and certifications
 * - Calculated years of experience
 * 
 * @param resumeText - Raw resume text (plain text or extracted from PDF)
 * @returns ParsedResume with structured fields
 * 
 * @example
 * const parsed = await parseResume(resumeText);
 * console.log(parsed.skills); // ["React", "TypeScript", "Node.js", ...]
 * console.log(parsed.years_of_experience); // 5
 */
export async function parseResume(resumeText: string): Promise<ParsedResume> {
  await rateLimiter.wait();
  const openai = getOpenAIClient();

  const completion = await openai.beta.chat.completions.parse({
    model: AI_CONFIG.model,
    messages: [
      { role: "system", content: RESUME_SYSTEM_PROMPT },
      { role: "user", content: `Parse this resume:\n\n${resumeText}` },
    ],
    response_format: zodResponseFormat(ParsedResumeSchema, "parsed_resume"),
    temperature: 0.3, // Lower temperature for more consistent extraction
  });

  const parsedResume = completion.choices[0].message.parsed;

  if (!parsedResume) {
    throw new Error("Failed to parse resume");
  }

  return parsedResume;
}

// ============================================================
// ANSWER EVALUATION
// ============================================================

/**
 * System prompt for answer evaluation
 * Provides scoring guidelines for interview answers
 */
const EVALUATION_SYSTEM_PROMPT = `You are evaluating a candidate's interview answer. Provide fair, constructive feedback.

SCORING (0-10):
- 9-10: Exceptional answer, demonstrates deep expertise
- 7-8: Strong answer, shows good understanding
- 5-6: Adequate answer, meets basic expectations
- 3-4: Weak answer, shows gaps in understanding
- 0-2: Poor answer, does not address the question

Evaluate each aspect of the scoring rubric and provide specific, actionable feedback.`;

/**
 * Evaluates a candidate's interview answer against a scoring rubric
 * 
 * Provides:
 * - Overall score (0-10)
 * - Constructive feedback
 * - Per-criterion score breakdown
 * - Optional follow-up question suggestion
 * 
 * @param question - The interview question with category and scoring rubric
 * @param answer - The candidate's text answer
 * @param jobContext - Job description for evaluation context
 * @param candidateBackground - Candidate info for personalized evaluation
 * @returns AnswerEvaluation with score, feedback, and breakdown
 * 
 * @example
 * const evaluation = await evaluateAnswer(
 *   { text: "Explain React hooks", category: "technical", scoring_rubric: [...] },
 *   "Hooks allow functional components to have state...",
 *   "Senior React Developer position",
 *   "5 years React experience"
 * );
 * // evaluation.score: 8
 * // evaluation.feedback: "Strong understanding of hooks with good examples..."
 */
export async function evaluateAnswer(
  question: {
    text: string;
    category: QuestionCategory;
    scoring_rubric: ScoringCriteria[];
  },
  answer: string,
  jobContext: string,
  candidateBackground: string
): Promise<AnswerEvaluation> {
  await rateLimiter.wait();
  const openai = getOpenAIClient();

  const rubricText = question.scoring_rubric
    .map(
      (r) =>
        `- ${r.aspect} (weight: ${r.weight}): Excellent: ${r.excellent}, Good: ${r.good}, Needs Work: ${r.needsWork}`
    )
    .join("\n");

  const userPrompt = `
QUESTION: ${question.text}
CATEGORY: ${question.category}

SCORING RUBRIC:
${rubricText}

CANDIDATE'S ANSWER:
${answer}

JOB CONTEXT: ${jobContext}

CANDIDATE BACKGROUND: ${candidateBackground}

Evaluate this answer against each aspect of the scoring rubric.`;

  const completion = await openai.beta.chat.completions.parse({
    model: AI_CONFIG.model,
    messages: [
      { role: "system", content: EVALUATION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: zodResponseFormat(AnswerEvaluationSchema, "evaluation"),
    temperature: 0.5,
  });

  const evaluation = completion.choices[0].message.parsed;

  if (!evaluation) {
    throw new Error("Failed to evaluate answer");
  }

  return evaluation;
}

// ============================================================
// JOB DESCRIPTION GENERATION
// ============================================================

/**
 * System prompt for job description generation
 * Creates inclusive, compelling job postings
 */
const JOB_DESCRIPTION_SYSTEM_PROMPT = `You are an expert recruiter who writes compelling, inclusive job descriptions.

RULES:
1. Use clear, jargon-free language
2. Focus on impact and growth opportunities
3. Be specific about responsibilities and requirements
4. Avoid gendered language and unnecessary requirements
5. Include information about team and culture
6. Keep it concise but comprehensive`;

/**
 * Generates an enhanced job description using AI
 * 
 * Creates or improves job descriptions to be:
 * - Compelling and engaging
 * - Inclusive (gender-neutral language)
 * - Clear about responsibilities and requirements
 * - Focused on growth opportunities
 * 
 * @param options - Job details to base description on
 * @param options.title - Job title
 * @param options.level - Seniority level
 * @param options.required_skills - Required technical skills
 * @param options.base_description - Optional existing description to enhance
 * @param options.department - Department name
 * @param options.location - Work location
 * @returns Generated or enhanced job description text
 * 
 * @example
 * const description = await generateJobDescription({
 *   title: "Senior Software Engineer",
 *   level: "senior",
 *   required_skills: ["React", "TypeScript", "Node.js"],
 *   department: "Platform"
 * });
 */
export async function generateJobDescription(options: {
  title: string;
  level?: string;
  required_skills: string[];
  base_description?: string;
  department?: string;
  location?: string;
}): Promise<string> {
  await rateLimiter.wait();
  const openai = getOpenAIClient();

  const userPrompt = `Generate a compelling job description for:
- Title: ${options.title}
- Level: ${options.level || "Not specified"}
- Department: ${options.department || "Not specified"}
- Location: ${options.location || "Not specified"}
- Required Skills: ${options.required_skills.join(", ")}
${options.base_description ? `\nBase description to enhance:\n${options.base_description}` : ""}

Create an engaging, inclusive job description that will attract top talent.`;

  const completion = await openai.chat.completions.create({
    model: AI_CONFIG.model,
    messages: [
      { role: "system", content: JOB_DESCRIPTION_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const description = completion.choices[0]?.message?.content;

  if (!description) {
    throw new Error("Failed to generate job description");
  }

  return description;
}
