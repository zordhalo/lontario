"use client"

import { useEffect } from "react"
import { RotateCcw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  InterviewProgress,
  JobDescriptionInput,
  ProfileInput,
  QuestionDisplay,
  FollowUpGenerator,
  InterviewErrorBoundary,
  ErrorAlert,
} from "@/components/interview"
import { useInterviewStore } from "@/lib/stores/interview-store"

/**
 * Main interview generator page
 * 3-step wizard: Job Details → Candidate Profile → Questions
 */
export default function InterviewPage() {
  const {
    currentStep,
    job,
    candidate,
    questions,
    isLoading,
    error,
    setJob,
    setCandidate,
    setError,
    generateQuestions,
    goBack,
    reset,
  } = useInterviewStore()

  // Generate questions when candidate is set
  useEffect(() => {
    if (currentStep === "profile" && candidate && !questions && !isLoading) {
      generateQuestions()
    }
  }, [currentStep, candidate, questions, isLoading, generateQuestions])

  // Handle profile submission - set candidate and trigger generation
  const handleProfileSubmit = async (profile: typeof candidate) => {
    setCandidate(profile!)
  }

  return (
    <InterviewErrorBoundary>
      <div className="space-y-8">
        {/* Header with Start Over button */}
        {currentStep !== "job" && (
          <div className="flex items-center justify-between">
            <div />
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Start Over
            </Button>
          </div>
        )}

        {/* Progress Indicator */}
        <InterviewProgress
          currentStep={currentStep}
          onStepClick={(step) => {
            // Only allow going back to completed steps
            if (
              (step === "job" && currentStep !== "job") ||
              (step === "profile" && currentStep === "questions")
            ) {
              if (step === "job") {
                reset()
              } else if (step === "profile") {
                goBack()
              }
            }
          }}
        />

        {/* Error Display */}
        {error && (
          <ErrorAlert
            error={error}
            onDismiss={() => setError(null)}
            onRetry={currentStep === "profile" ? generateQuestions : undefined}
          />
        )}

        {/* Loading Overlay */}
        {isLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 rounded-lg border bg-card p-8 shadow-lg">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="text-lg font-semibold">Generating Questions...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  AI is analyzing the job and candidate profile
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step Content */}
        {currentStep === "job" && (
          <JobDescriptionInput
            onSubmit={setJob}
            initialData={job || undefined}
          />
        )}

        {currentStep === "profile" && !questions && (
          <ProfileInput
            onSubmit={handleProfileSubmit}
            onBack={goBack}
            initialData={candidate || undefined}
          />
        )}

        {currentStep === "questions" && questions && job && (
          <div className="space-y-8">
            <QuestionDisplay questionSet={questions} />
            <FollowUpGenerator
              questions={questions.questions}
              jobDescription={job}
            />
          </div>
        )}
      </div>
    </InterviewErrorBoundary>
  )
}
