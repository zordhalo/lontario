"use client";

import { useEffect, useState, useCallback } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  Loader2,
  Play,
  Send,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { InterviewQuestion } from "@/types";

// Interview states
type InterviewState =
  | "loading"
  | "too_early"
  | "ready"
  | "in_progress"
  | "completed"
  | "expired"
  | "invalid";

interface InterviewData {
  interview_id: string;
  status: string;
  can_start: boolean;
  reason?: string;
  job?: {
    id: string;
    title: string;
    level?: string;
  };
  duration_minutes: number;
  total_questions: number;
  questions_answered: number;
  scheduled_at?: string;
  minutes_until_start?: number;
  expires_at?: string;
}

interface QuestionWithAnswer extends InterviewQuestion {
  user_answer: string;
  time_started: number;
}

interface CandidateInterviewClientProps {
  token: string;
}

export default function CandidateInterviewClient({ token }: CandidateInterviewClientProps) {
  const [state, setState] = useState<InterviewState>("loading");
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [questions, setQuestions] = useState<QuestionWithAnswer[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Fetch interview data
  const fetchInterviewStatus = useCallback(async () => {
    try {
      // First try to get interview ID from token (token is actually the ID in our URL pattern)
      // We need to extract the interview ID from the interview_link which contains the token
      const response = await fetch(`/api/interviews/${token}/start?token=${token}`);

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 401) {
          setState("invalid");
          setError("Invalid or expired interview link");
          return;
        }
        if (response.status === 410) {
          setState("expired");
          setError("This interview has expired");
          return;
        }
        throw new Error(errorData.error || "Failed to load interview");
      }

      const data: InterviewData = await response.json();
      setInterviewData(data);

      // Determine state based on response
      if (!data.can_start) {
        if (data.reason?.includes("not started yet") || data.minutes_until_start) {
          setState("too_early");
          setCountdown(data.minutes_until_start || 0);
        } else if (data.status === "completed") {
          setState("completed");
        } else if (data.status === "expired" || data.status === "cancelled") {
          setState("expired");
          setError(data.reason || "Interview is no longer available");
        } else {
          setState("invalid");
          setError(data.reason || "Unable to access interview");
        }
      } else {
        setState(data.status === "in_progress" ? "in_progress" : "ready");
      }
    } catch (err) {
      setState("invalid");
      setError(err instanceof Error ? err.message : "Failed to load interview");
    }
  }, [token]);

  // Start the interview
  const startInterview = async (forceStart = false) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/interviews/${token}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, force_start: forceStart }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 425) {
          // Too early
          setState("too_early");
          setCountdown(errorData.details?.minutes_until_start || 0);
          return;
        }
        throw new Error(errorData.error || "Failed to start interview");
      }

      const data = await response.json();

      // Initialize questions with user answer tracking
      const questionsWithAnswers: QuestionWithAnswer[] = data.questions.map(
        (q: InterviewQuestion) => ({
          ...q,
          user_answer: q.candidate_answer || "",
          time_started: Date.now(),
        })
      );

      setQuestions(questionsWithAnswers);
      setState("in_progress");

      // Find first unanswered question
      const firstUnanswered = questionsWithAnswers.findIndex(
        (q) => !q.candidate_answer
      );
      setCurrentQuestionIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start interview");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save answer and move to next question
  const saveAndNext = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion.user_answer.trim()) {
      setError("Please provide an answer before continuing");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Save the current answer
      await fetch(`/api/interviews/${token}/submit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          question_id: currentQuestion.id,
          answer: currentQuestion.user_answer,
          time_spent_seconds: Math.floor((Date.now() - currentQuestion.time_started) / 1000),
        }),
      });

      // Move to next question or show completion if last
      if (currentQuestionIndex < questions.length - 1) {
        // Update the time_started for the next question
        const updatedQuestions = [...questions];
        updatedQuestions[currentQuestionIndex + 1].time_started = Date.now();
        setQuestions(updatedQuestions);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
    } catch (err) {
      setError("Failed to save answer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit all answers
  const submitInterview = async () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion.user_answer.trim()) {
      setError("Please provide an answer before submitting");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Prepare all answers
      const answers = questions.map((q) => ({
        question_id: q.id,
        answer: q.user_answer,
        time_spent_seconds: q.time_spent_seconds || 0,
      }));

      const response = await fetch(`/api/interviews/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, answers }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit interview");
      }

      setState("completed");
    } catch (err) {
      setError("Failed to submit interview. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update answer for current question
  const updateAnswer = (answer: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[currentQuestionIndex].user_answer = answer;
    setQuestions(updatedQuestions);
  };

  // Initial fetch
  useEffect(() => {
    fetchInterviewStatus();
  }, [fetchInterviewStatus]);

  // Countdown timer for too_early state
  useEffect(() => {
    if (state === "too_early" && countdown > 0) {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // Refresh status when countdown ends
            fetchInterviewStatus();
            return 0;
          }
          return prev - 1;
        });
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [state, countdown, fetchInterviewStatus]);

  // Elapsed time tracker for in_progress state
  useEffect(() => {
    if (state === "in_progress") {
      const interval = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [state]);

  // Format elapsed time
  const formatElapsedTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Loading state
  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading your interview...</p>
        </div>
      </div>
    );
  }

  // Invalid/Expired state
  if (state === "invalid" || state === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>
              {state === "expired" ? "Interview Expired" : "Invalid Link"}
            </CardTitle>
            <CardDescription>
              {error || "This interview link is no longer valid."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              If you believe this is an error, please contact the recruiter who
              sent you this link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Too early state
  if (state === "too_early" && interviewData) {
    const scheduledDate = interviewData.scheduled_at
      ? new Date(interviewData.scheduled_at)
      : null;

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Interview Not Yet Available</CardTitle>
            <CardDescription>
              Your interview is scheduled for a later time
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {interviewData.job && (
              <div className="text-center">
                <p className="font-medium">{interviewData.job.title}</p>
                {interviewData.job.level && (
                  <Badge variant="secondary" className="mt-1">
                    {interviewData.job.level}
                  </Badge>
                )}
              </div>
            )}

            {scheduledDate && (
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">
                  Scheduled for
                </p>
                <p className="text-xl font-semibold">
                  {format(scheduledDate, "EEEE, MMMM d")}
                </p>
                <p className="text-lg">{format(scheduledDate, "h:mm a")}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Starts {formatDistanceToNow(scheduledDate, { addSuffix: true })}
                </p>
              </div>
            )}

            <div className="text-center text-sm text-muted-foreground">
              <p>You can start the interview 5 minutes before the scheduled time,</p>
              <p>or start it now if you're ready.</p>
              <p className="mt-2">Duration: ~{interviewData.duration_minutes} minutes</p>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Button 
                onClick={() => startInterview(true)} 
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Interview Now
                  </>
                )}
              </Button>
              <Button onClick={fetchInterviewStatus} variant="outline" className="w-full">
                <Clock className="mr-2 h-4 w-4" />
                Check Availability
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Ready state
  if (state === "ready" && interviewData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <Play className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>Ready to Begin</CardTitle>
            <CardDescription>
              Your AI interview is ready to start
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {interviewData.job && (
              <div className="text-center">
                <p className="font-medium text-lg">{interviewData.job.title}</p>
                {interviewData.job.level && (
                  <Badge variant="secondary" className="mt-1">
                    {interviewData.job.level}
                  </Badge>
                )}
              </div>
            )}

            <div className="bg-muted rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Questions</span>
                <span className="font-medium">{interviewData.total_questions}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">~{interviewData.duration_minutes} minutes</span>
              </div>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Before you begin:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Find a quiet place with stable internet</li>
                <li>Your answers are automatically saved</li>
                <li>You can take your time - there's no strict time limit per question</li>
                <li>Be specific and provide examples when possible</li>
              </ul>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <Button
              onClick={startInterview}
              disabled={isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Interview
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // In progress state
  if (state === "in_progress" && questions.length > 0) {
    const currentQuestion = questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const isLastQuestion = currentQuestionIndex === questions.length - 1;

    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="max-w-3xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  Question {currentQuestionIndex + 1} of {questions.length}
                </Badge>
                {currentQuestion.category && (
                  <Badge variant="outline">{currentQuestion.category}</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Timer className="h-4 w-4" />
                {formatElapsedTime(elapsedTime)}
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Question */}
            <div className="space-y-2">
              {currentQuestion.difficulty && (
                <Badge
                  variant={
                    currentQuestion.difficulty === "hard"
                      ? "destructive"
                      : currentQuestion.difficulty === "medium"
                        ? "default"
                        : "secondary"
                  }
                >
                  {currentQuestion.difficulty}
                </Badge>
              )}
              <h2 className="text-xl font-semibold">{currentQuestion.question_text}</h2>
              {currentQuestion.question_context && (
                <p className="text-muted-foreground">{currentQuestion.question_context}</p>
              )}
            </div>

            {/* Answer input */}
            <div className="space-y-2">
              <Textarea
                placeholder="Type your answer here..."
                value={currentQuestion.user_answer}
                onChange={(e) => updateAnswer(e.target.value)}
                rows={8}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {currentQuestion.user_answer.length} characters
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0 || isSubmitting}
              >
                Previous
              </Button>

              {isLastQuestion ? (
                <Button
                  onClick={submitInterview}
                  disabled={isSubmitting || !currentQuestion.user_answer.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit Interview
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={saveAndNext}
                  disabled={isSubmitting || !currentQuestion.user_answer.trim()}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Question navigation dots */}
            <div className="flex justify-center gap-2 pt-4">
              {questions.map((q, idx) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentQuestionIndex(idx)}
                  className={cn(
                    "w-3 h-3 rounded-full transition-colors",
                    idx === currentQuestionIndex
                      ? "bg-primary"
                      : q.user_answer
                        ? "bg-green-500"
                        : "bg-muted"
                  )}
                  title={`Question ${idx + 1}${q.user_answer ? " (answered)" : ""}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Completed state
  if (state === "completed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <CardTitle>Interview Complete!</CardTitle>
            <CardDescription>
              Thank you for completing your AI interview
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-muted-foreground">
              Your responses have been submitted and are being reviewed.
              The hiring team will be in touch with next steps.
            </p>
            <div className="bg-muted rounded-lg p-4 text-sm">
              <p className="font-medium mb-2">What happens next?</p>
              <ul className="text-muted-foreground space-y-1 text-left">
                <li>Your answers will be evaluated by our AI</li>
                <li>The recruiter will review your responses</li>
                <li>You'll receive an email with updates</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fallback
  return null;
}
