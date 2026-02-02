"use client"

import { useState } from "react"
import {
  Code,
  Users,
  Layout,
  Lightbulb,
  Heart,
  HelpCircle,
  Clock,
  ChevronDown,
  User,
  Briefcase,
} from "lucide-react"
import { cn, formatDuration, getDifficultyColor, getCategoryLabel } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ScoringRubric } from "./ScoringRubric"
import type { QuestionSet, GeneratedQuestion, QuestionCategory } from "@/types"

interface QuestionDisplayProps {
  questionSet: QuestionSet
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  technical: Code,
  behavioral: Users,
  "system-design": Layout,
  "problem-solving": Lightbulb,
  "culture-fit": Heart,
}

const CATEGORIES: QuestionCategory[] = [
  "technical",
  "behavioral",
  "system-design",
  "problem-solving",
  "culture-fit",
]

/**
 * Displays generated interview questions with summary and category tabs
 * Shows difficulty breakdown, time estimates, and scoring rubrics
 */
export function QuestionDisplay({ questionSet }: QuestionDisplayProps) {
  const [activeCategory, setActiveCategory] = useState<QuestionCategory | "all">(
    "all"
  )

  const groupedQuestions = questionSet.groupedByCategory || {}

  // Count questions by difficulty
  const difficultyCount = questionSet.questions.reduce(
    (acc, q) => {
      acc[q.difficulty] = (acc[q.difficulty] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Get questions for current tab
  const displayedQuestions =
    activeCategory === "all"
      ? questionSet.questions
      : groupedQuestions[activeCategory] || []

  // Filter categories that have questions
  const availableCategories = CATEGORIES.filter(
    (cat) => groupedQuestions[cat] && groupedQuestions[cat].length > 0
  )

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Interview Questions Generated</span>
            <Badge variant="secondary" className="text-base font-normal">
              {questionSet.questions.length} Questions
            </Badge>
          </CardTitle>
          <CardDescription>
            Personalized questions for {questionSet.candidateName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Candidate */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Candidate</p>
                <p className="font-medium truncate max-w-[120px]">
                  {questionSet.candidateName}
                </p>
              </div>
            </div>

            {/* Position */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Position</p>
                <p className="font-medium truncate max-w-[120px]">
                  {questionSet.jobTitle}
                </p>
              </div>
            </div>

            {/* Duration */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Est. Duration</p>
                <p className="font-medium">
                  {formatDuration(questionSet.totalEstimatedTime)}
                </p>
              </div>
            </div>

            {/* Difficulty Breakdown */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <HelpCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Difficulty</p>
                <div className="flex gap-1.5">
                  {difficultyCount.easy && (
                    <Badge
                      variant="outline"
                      className={cn("text-xs", getDifficultyColor("easy"))}
                    >
                      {difficultyCount.easy} Easy
                    </Badge>
                  )}
                  {difficultyCount.medium && (
                    <Badge
                      variant="outline"
                      className={cn("text-xs", getDifficultyColor("medium"))}
                    >
                      {difficultyCount.medium} Med
                    </Badge>
                  )}
                  {difficultyCount.hard && (
                    <Badge
                      variant="outline"
                      className={cn("text-xs", getDifficultyColor("hard"))}
                    >
                      {difficultyCount.hard} Hard
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Questions by Category */}
      <Card>
        <CardContent className="pt-6">
          <Tabs
            value={activeCategory}
            onValueChange={(v) => setActiveCategory(v as QuestionCategory | "all")}
          >
            <TabsList className="flex flex-wrap h-auto gap-1 mb-6">
              <TabsTrigger value="all" className="gap-2">
                All ({questionSet.questions.length})
              </TabsTrigger>
              {availableCategories.map((category) => {
                const Icon = CATEGORY_ICONS[category] || HelpCircle
                const count = groupedQuestions[category]?.length || 0
                return (
                  <TabsTrigger key={category} value={category} className="gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {getCategoryLabel(category)}
                    </span>
                    <span className="sm:hidden">
                      {getCategoryLabel(category).split(" ")[0]}
                    </span>
                    ({count})
                  </TabsTrigger>
                )
              })}
            </TabsList>

            <TabsContent value={activeCategory} className="mt-0">
              <div className="space-y-4">
                {displayedQuestions.map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    number={
                      activeCategory === "all"
                        ? index + 1
                        : displayedQuestions.indexOf(question) + 1
                    }
                  />
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Individual question card with expandable context and scoring rubric
 */
function QuestionCard({
  question,
  number,
}: {
  question: GeneratedQuestion
  number: number
}) {
  const [contextOpen, setContextOpen] = useState(false)
  const Icon = CATEGORY_ICONS[question.category] || HelpCircle

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
            {number}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Icon className="h-3 w-3" />
              {getCategoryLabel(question.category)}
            </Badge>
            <Badge
              variant="outline"
              className={cn("border", getDifficultyColor(question.difficulty))}
            >
              {question.difficulty}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground text-sm shrink-0">
          <Clock className="h-4 w-4" />
          {question.estimatedTime} min
        </div>
      </div>

      {/* Question Text */}
      <p className="text-base font-medium mb-4">{question.question}</p>

      {/* Context (Collapsible) */}
      {question.context && (
        <Collapsible
          open={contextOpen}
          onOpenChange={setContextOpen}
          className="mb-4"
        >
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                contextOpen && "rotate-180"
              )}
            />
            Why this question?
          </CollapsibleTrigger>
          <CollapsibleContent>
            <p className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
              {question.context}
            </p>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Scoring Rubric */}
      <ScoringRubric rubric={question.scoringRubric} />
    </div>
  )
}
