"use client"

import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AIScoreBadgeProps {
  score: number
  size?: "sm" | "md" | "lg"
  showIcon?: boolean
  explanation?: string
}

export function AIScoreBadge({
  score,
  size = "md",
  showIcon = true,
  explanation,
}: AIScoreBadgeProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return "bg-success/15 text-success border-success/30"
    if (score >= 70) return "bg-warning/15 text-warning border-warning/30"
    return "bg-muted text-muted-foreground border-border"
  }

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5 gap-1",
    md: "text-sm px-2 py-1 gap-1.5",
    lg: "text-base px-3 py-1.5 gap-2",
  }

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  }

  const badge = (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full border",
        getScoreColor(score),
        sizeClasses[size]
      )}
    >
      {showIcon && <Sparkles className={iconSizes[size]} />}
      {score}%
    </span>
  )

  if (explanation) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">{explanation}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return badge
}
