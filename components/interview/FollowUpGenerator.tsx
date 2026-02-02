"use client"

import { useState } from "react"
import { RefreshCw, Loader2, MessageSquare, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGenerateFollowUp } from "@/hooks/use-ai"
import type {
  GeneratedQuestion,
  JobDescription,
  FollowUpResponse,
} from "@/types"

interface FollowUpGeneratorProps {
  questions: GeneratedQuestion[]
  jobDescription: JobDescription
}

/**
 * Component for generating intelligent follow-up questions
 * Takes candidate answer and generates contextual follow-up
 */
export function FollowUpGenerator({
  questions,
  jobDescription,
}: FollowUpGeneratorProps) {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("")
  const [candidateAnswer, setCandidateAnswer] = useState("")
  const [followUp, setFollowUp] = useState<FollowUpResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const generateFollowUp = useGenerateFollowUp()

  const selectedQuestion = questions.find((q) => q.id === selectedQuestionId)

  const handleGenerate = () => {
    if (!selectedQuestion || candidateAnswer.length < 10) {
      setError("Please select a question and provide an answer (min 10 characters)")
      return
    }

    setError(null)
    setFollowUp(null)

    generateFollowUp.mutate(
      {
        originalQuestion: selectedQuestion,
        candidateAnswer,
        jobDescription,
      },
      {
        onSuccess: (data) => {
          setFollowUp(data)
        },
        onError: (err) => {
          setError(err.message)
        },
      }
    )
  }

  const handleReset = () => {
    setSelectedQuestionId("")
    setCandidateAnswer("")
    setFollowUp(null)
    setError(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Follow-Up Question Generator
        </CardTitle>
        <CardDescription>
          Generate intelligent follow-up questions based on candidate answers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Question Selector */}
        <div className="space-y-2">
          <Label htmlFor="question-select">Select Question</Label>
          <Select
            value={selectedQuestionId}
            onValueChange={setSelectedQuestionId}
          >
            <SelectTrigger id="question-select">
              <SelectValue placeholder="Choose a question to follow up on" />
            </SelectTrigger>
            <SelectContent>
              {questions.map((q, index) => (
                <SelectItem key={q.id} value={q.id}>
                  <span className="truncate">
                    Q{index + 1}: {q.question.slice(0, 60)}
                    {q.question.length > 60 ? "..." : ""}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Question Preview */}
        {selectedQuestion && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <Label className="text-xs uppercase text-muted-foreground">
              Original Question
            </Label>
            <p className="mt-1 text-sm">{selectedQuestion.question}</p>
          </div>
        )}

        {/* Candidate Answer Input */}
        <div className="space-y-2">
          <Label htmlFor="candidate-answer">
            Candidate&apos;s Answer (min 10 characters)
          </Label>
          <Textarea
            id="candidate-answer"
            placeholder="Enter the candidate's response to this question..."
            value={candidateAnswer}
            onChange={(e) => setCandidateAnswer(e.target.value)}
            className="min-h-[120px] resize-y"
            disabled={!selectedQuestion}
          />
          <p className="text-xs text-muted-foreground">
            {candidateAnswer.length} / 10 characters minimum
          </p>
        </div>

        {/* Generate Button */}
        <div className="flex gap-3">
          <Button
            onClick={handleGenerate}
            disabled={
              !selectedQuestion ||
              candidateAnswer.length < 10 ||
              generateFollowUp.isPending
            }
            className="flex-1"
          >
            {generateFollowUp.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Follow-Up"
            )}
          </Button>
          {(followUp || error) && (
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Follow-Up Result */}
        {followUp && (
          <div className="space-y-4">
            {/* Follow-Up Question */}
            <div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <Label className="text-xs uppercase text-primary font-semibold">
                  Follow-Up Question
                </Label>
              </div>
              <p className="font-medium">{followUp.followUp}</p>
            </div>

            {/* Rationale */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                <Label className="text-xs uppercase text-muted-foreground">
                  Why This Follow-Up?
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {followUp.rationale}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
