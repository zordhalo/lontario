"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AppStep } from "@/types"

interface InterviewProgressProps {
  currentStep: AppStep
  onStepClick?: (step: AppStep) => void
}

const steps: { id: AppStep; label: string; description: string }[] = [
  { id: "job", label: "Job Details", description: "Define the position" },
  { id: "profile", label: "Candidate", description: "Add profile info" },
  { id: "questions", label: "Questions", description: "View results" },
]

/**
 * Progress indicator component for the 3-step interview wizard
 * Shows current progress and allows navigation to completed steps
 */
export function InterviewProgress({
  currentStep,
  onStepClick,
}: InterviewProgressProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep)

  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex
          const isCurrent = step.id === currentStep
          const isClickable = isCompleted && onStepClick

          return (
            <li key={step.id} className="relative flex-1">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div
                  className="absolute left-[calc(50%+20px)] right-[calc(-50%+20px)] top-5 h-0.5 -translate-y-1/2"
                  aria-hidden="true"
                >
                  <div
                    className={cn(
                      "h-full transition-colors duration-300",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                </div>
              )}

              {/* Step indicator */}
              <div
                className={cn(
                  "group relative flex flex-col items-center",
                  isClickable && "cursor-pointer"
                )}
                onClick={() => isClickable && onStepClick(step.id)}
              >
                {/* Circle */}
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300",
                    isCompleted
                      ? "border-primary bg-primary text-primary-foreground"
                      : isCurrent
                        ? "border-primary bg-background text-primary ring-4 ring-primary/20"
                        : "border-muted bg-background text-muted-foreground",
                    isClickable &&
                      "group-hover:ring-4 group-hover:ring-primary/20"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </span>

                {/* Labels */}
                <div className="mt-3 text-center">
                  <span
                    className={cn(
                      "block text-sm font-medium transition-colors",
                      isCurrent || isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {step.description}
                  </span>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
