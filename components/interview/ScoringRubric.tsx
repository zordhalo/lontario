"use client"

import { useState } from "react"
import { ChevronDown, CheckCircle, AlertTriangle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { ScoringCriteria } from "@/types"

interface ScoringRubricProps {
  rubric: ScoringCriteria[]
  defaultOpen?: boolean
}

/**
 * Displays scoring rubric criteria in a collapsible format
 * Shows three tiers: Excellent, Good, Needs Work with visual indicators
 */
export function ScoringRubric({
  rubric,
  defaultOpen = false,
}: ScoringRubricProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium hover:bg-muted transition-colors">
        <span>Scoring Rubric ({rubric.length} criteria)</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 space-y-4">
          {rubric.map((criteria, index) => (
            <CriteriaCard key={index} criteria={criteria} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * Individual scoring criteria card showing aspect, weight, and tier descriptions
 */
function CriteriaCard({ criteria }: { criteria: ScoringCriteria }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header with aspect name and weight */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium">{criteria.aspect}</span>
        <WeightIndicator weight={criteria.weight} />
      </div>

      {/* Tier descriptions */}
      <div className="space-y-2">
        {/* Excellent */}
        <div className="rounded-md bg-green-50 dark:bg-green-950/30 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 mt-0.5 text-green-600 dark:text-green-400 shrink-0" />
            <div>
              <span className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">
                Excellent
              </span>
              <p className="text-sm text-green-800 dark:text-green-300 mt-1">
                {criteria.excellent}
              </p>
            </div>
          </div>
        </div>

        {/* Good */}
        <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/30 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <div>
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-400 uppercase tracking-wide">
                Good
              </span>
              <p className="text-sm text-yellow-800 dark:text-yellow-300 mt-1">
                {criteria.good}
              </p>
            </div>
          </div>
        </div>

        {/* Needs Work */}
        <div className="rounded-md bg-red-50 dark:bg-red-950/30 p-3">
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <span className="text-xs font-medium text-red-700 dark:text-red-400 uppercase tracking-wide">
                Needs Work
              </span>
              <p className="text-sm text-red-800 dark:text-red-300 mt-1">
                {criteria.needsWork}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Visual indicator for criteria weight (1-5 scale)
 */
function WeightIndicator({ weight }: { weight: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Weight:</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={cn(
              "h-2 w-2 rounded-full",
              i <= weight
                ? "bg-primary"
                : "bg-muted-foreground/20"
            )}
          />
        ))}
      </div>
    </div>
  )
}
