"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CheckCircle,
  ClipboardCheck,
  ExternalLink,
  Github,
  Globe,
  Linkedin,
  Loader2,
  Mail,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AIScoreBadge } from "@/components/ai-score-badge"
import { ScheduleDialog } from "@/components/interview"
import { useToast } from "@/hooks/use-toast"
import { useDeleteCandidate, useCandidate } from "@/hooks/use-candidates"
import { useMarkInterviewReviewed } from "@/hooks/use-dashboard"
import type { Candidate } from "@/lib/mock-data"
import type { AIInterview } from "@/types"

interface CandidatePanelProps {
  candidate: Candidate
  jobId?: string
  jobTitle?: string
  open: boolean
  onClose: () => void
  onStatusChange: (status: Candidate["status"]) => void
  onInterviewScheduled?: (interview: { id: string; scheduled_at: string; interview_link: string }) => void
  onDelete?: () => void
}

const statusOptions: { value: Candidate["status"]; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "screening", label: "Screening" },
  { value: "ai_interview", label: "AI Interview" },
  { value: "phone_screen", label: "Phone Screen" },
  { value: "technical", label: "Technical" },
  { value: "onsite", label: "Onsite" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
]

// Format timestamp to human-readable "time ago" format
function formatTimeAgo(dateString: string | undefined): string {
  if (!dateString) return "Unknown date"
  
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`
    
    // For older dates, show formatted date
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    })
  } catch {
    return dateString
  }
}

// Get full date string for tooltip
function formatFullDate(dateString: string | undefined): string {
  if (!dateString) return ""
  try {
    const date = new Date(dateString)
    return date.toLocaleString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return dateString
  }
}

export function CandidatePanel({
  candidate,
  jobId,
  jobTitle,
  open,
  onClose,
  onStatusChange,
  onInterviewScheduled,
  onDelete,
}: CandidatePanelProps) {
  // All hooks must be called before any early return (Rules of Hooks)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const { toast } = useToast()
  const deleteCandidate = useDeleteCandidate()
  
  // Fetch detailed candidate data including interview (only when we have a valid candidate)
  const { data: candidateDetails } = useCandidate(open && candidate?.id ? candidate.id : '')
  const interview = candidateDetails?.interview as AIInterview | null
  
  // Merge fresh API data with prop data to display up-to-date scored information
  const displayCandidate = useMemo(() => {
    if (!candidateDetails) return candidate;
    
    // Merge fresh data from API with prop data
    // API data takes precedence when available
    const details = candidateDetails as Record<string, unknown>;
    return {
      ...candidate,
      // Avatar - prefer fresh API data
      avatar_url: (details.avatar_url as string) || candidate.avatar_url,
      avatar: (details.avatar_url as string) || candidate.avatar,
      // AI Score - prefer fresh API data
      aiScore: (details.ai_score as number) ?? candidate.aiScore ?? 0,
      ai_score: (details.ai_score as number) ?? candidate.ai_score,
      // Skills - prefer fresh API data
      skills: (details.extracted_skills as string[]) || candidate.skills || [],
      extracted_skills: (details.extracted_skills as string[]) || candidate.extracted_skills,
      // Experience - calculate from years if available
      experience: (details.years_of_experience as number)
        ? `${details.years_of_experience} years`
        : candidate.experience,
      years_of_experience: (details.years_of_experience as number) ?? candidate.years_of_experience,
      // AI Analysis
      summary: (details.ai_summary as string) || candidate.summary,
      ai_summary: (details.ai_summary as string) || candidate.ai_summary,
      strengths: (details.ai_strengths as string[]) || candidate.strengths,
      ai_strengths: (details.ai_strengths as string[]) || candidate.ai_strengths,
      concerns: (details.ai_concerns as string[]) || candidate.concerns,
      ai_concerns: (details.ai_concerns as string[]) || candidate.ai_concerns,
      // Question generation status
      questionGenerationStatus: (details.question_generation_status as string) || candidate.questionGenerationStatus || "none",
      question_generation_status: (details.question_generation_status as string) || candidate.question_generation_status || "none",
    };
  }, [candidate, candidateDetails]);
  
  // Check if there's a scheduled interview
  const hasScheduledInterview = interview?.scheduled_at && 
    ['scheduled', 'ready', 'sent', 'pending'].includes(interview?.status || '')
  
  // Check if interview is completed
  const hasCompletedInterview = interview?.status === 'completed'
  
  // Hook for marking interview as reviewed (invalidates dashboard alerts)
  const markReviewed = useMarkInterviewReviewed()
  
  // Track if we've already marked this interview as reviewed
  const reviewedInterviewRef = useRef<string | null>(null)
  
  // Auto-mark completed interviews as reviewed when panel is opened
  useEffect(() => {
    // Only mark as reviewed if:
    // 1. Panel is open
    // 2. Interview is completed
    // 3. Interview hasn't been reviewed yet (reviewed_at is null)
    // 4. We haven't already sent the review request for this interview
    // 5. The mutation is not currently in progress
    if (
      open && 
      hasCompletedInterview && 
      interview?.id &&
      !interview.reviewed_at &&
      reviewedInterviewRef.current !== interview.id &&
      !markReviewed.isPending
    ) {
      // Mark as reviewed (this also invalidates dashboard alerts)
      reviewedInterviewRef.current = interview.id
      markReviewed.mutate(interview.id, {
        onError: () => {
          // Reset ref so we can try again if panel is reopened
          reviewedInterviewRef.current = null
        }
      })
    }
  }, [open, hasCompletedInterview, interview?.id, interview?.reviewed_at, markReviewed])

  // Early return if no valid candidate - prevents errors when dialog is closed
  if (!open || !candidate?.name) {
    return null
  }

  const initials = displayCandidate.name
    .split(" ")
    .map((n) => n[0])
    .join("")

  const handleInterviewScheduled = (interview: { id: string; scheduled_at: string; interview_link: string }) => {
    toast({
      title: "Interview Scheduled",
      description: `AI interview scheduled for ${new Date(interview.scheduled_at).toLocaleDateString()} at ${new Date(interview.scheduled_at).toLocaleTimeString()}`,
    })
    onInterviewScheduled?.(interview)
  }

  const handleDeleteCandidate = async () => {
    try {
      await deleteCandidate.mutateAsync(candidate.id)
      toast({
        title: "Candidate Deleted",
        description: `${candidate.name} has been removed from the pipeline.`,
      })
      setDeleteDialogOpen(false)
      onClose()
      onDelete?.()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete candidate",
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-[70vw] sm:max-w-[70vw] w-[70vw] h-[85vh] max-h-[85vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 pr-12 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                {(displayCandidate.avatar_url || displayCandidate.avatar) ? (
                  <AvatarImage 
                    src={displayCandidate.avatar_url || displayCandidate.avatar} 
                    alt={displayCandidate.name}
                    className="object-cover"
                  />
                ) : null}
                <AvatarFallback className="text-xl bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-xl font-semibold text-foreground">
                  {displayCandidate.name}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Candidate profile and details for {displayCandidate.name}
                </DialogDescription>
                <p className="text-sm text-muted-foreground mt-1">
                  {displayCandidate.experience} experience
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 -ml-8">
              <AIScoreBadge
                score={displayCandidate.aiScore}
                size="lg"
                showIcon
                explanation="AI match score based on skills, experience, and job requirements analysis."
              />
              <Select
                value={displayCandidate.status}
                onValueChange={(value) =>
                  onStatusChange(value as Candidate["status"])
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs - Improved styling */}
        <Tabs defaultValue="summary" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 shrink-0 bg-muted/50">
            <TabsTrigger 
              value="summary" 
              className="flex-1 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all"
            >
              AI Summary
            </TabsTrigger>
            <TabsTrigger 
              value="resume" 
              className="flex-1 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all"
            >
              Resume
            </TabsTrigger>
            <TabsTrigger 
              value="timeline" 
              className="flex-1 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none transition-all"
            >
              Timeline
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-0">
            <TabsContent value="summary" className="m-0 p-6 space-y-6">
            {/* Interview Results - Show if completed */}
            {hasCompletedInterview && interview && (
              <section className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-primary" />
                  Interview Results
                </h3>
                <div className="space-y-3">
                  {/* Score and Recommendation */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Interview Score</span>
                    <span className={cn(
                      "text-lg font-semibold",
                      (interview.overall_score ?? 0) >= 70 ? "text-success" :
                      (interview.overall_score ?? 0) >= 50 ? "text-warning" : "text-destructive"
                    )}>
                      {interview.overall_score ?? 0}%
                    </span>
                  </div>
                  {interview.recommendation && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Recommendation</span>
                      <span className={cn(
                        "text-sm font-medium px-2 py-0.5 rounded-full",
                        interview.recommendation === "strong_yes" && "bg-success/20 text-success",
                        interview.recommendation === "yes" && "bg-success/10 text-success",
                        interview.recommendation === "maybe" && "bg-warning/20 text-warning",
                        interview.recommendation === "no" && "bg-destructive/10 text-destructive",
                        interview.recommendation === "strong_no" && "bg-destructive/20 text-destructive"
                      )}>
                        {interview.recommendation.replace("_", " ")}
                      </span>
                    </div>
                  )}
                  {interview.completed_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Completed</span>
                      <span className="text-sm text-foreground">
                        {new Date(interview.completed_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                  {/* Interview Summary */}
                  {interview.ai_summary && (
                    <div className="pt-2 border-t border-border/50">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {interview.ai_summary}
                      </p>
                    </div>
                  )}
                  {/* Strengths from interview */}
                  {interview.strengths && interview.strengths.length > 0 && (
                    <div className="pt-2 space-y-1.5">
                      {interview.strengths.map((strength, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-3.5 w-3.5 text-success mt-0.5 shrink-0" />
                          <span className="text-foreground">{strength}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Concerns from interview */}
                  {interview.concerns && interview.concerns.length > 0 && (
                    <div className="space-y-1.5">
                      {interview.concerns.map((concern, index) => (
                        <div key={index} className="flex items-start gap-2 text-sm">
                          <AlertCircle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                          <span className="text-foreground">{concern}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* AI Match Breakdown */}
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center">
                  <span className="text-primary text-xs">AI</span>
                </span>
                Match Breakdown
                <span className="text-xs text-muted-foreground font-normal">(trust us, we&apos;re robots)</span>
              </h3>
              <div className="space-y-2">
                {displayCandidate.strengths?.map((strength, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-sm"
                  >
                    <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                    <span className="text-foreground">{strength}</span>
                  </div>
                ))}
                {displayCandidate.concerns?.map((concern, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-sm"
                  >
                    <AlertCircle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                    <span className="text-foreground">{concern}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Why This Candidate */}
            {displayCandidate.summary && (
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Why This Candidate
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {displayCandidate.summary}
                </p>
              </section>
            )}

            {/* Skills */}
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {displayCandidate.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-sm px-2.5 py-1 rounded-full bg-primary/10 text-primary"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>

            {/* Links */}
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Links
              </h3>
              <div className="flex flex-wrap gap-2">
                {displayCandidate.linkedIn && (
                  <a
                    href={displayCandidate.linkedIn}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
                  >
                    <Linkedin className="h-4 w-4" />
                    LinkedIn
                  </a>
                )}
                {displayCandidate.github && (
                  <a
                    href={displayCandidate.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
                  >
                    <Github className="h-4 w-4" />
                    GitHub
                  </a>
                )}
                {displayCandidate.portfolio && (
                  <a
                    href={displayCandidate.portfolio}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
                  >
                    <Globe className="h-4 w-4" />
                    Portfolio
                  </a>
                )}
              </div>
            </section>
            </TabsContent>

            <TabsContent value="resume" className="m-0 p-6">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ExternalLink className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-1">
                Resume Preview
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Full document available for download
                <span className="block text-xs text-muted-foreground/60 mt-1">
                  (it&apos;s just Lorem Ipsum, but very professional Lorem Ipsum)
                </span>
              </p>
              <Button variant="outline" size="sm" className="hover:bg-primary/5 hover:border-primary/30">
                Download Resume
              </Button>
            </div>
            </TabsContent>

            <TabsContent value="timeline" className="m-0 p-6">
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <div className="w-px flex-1 bg-border" />
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium text-foreground">Applied</p>
                  <p className="text-xs text-muted-foreground" title={formatFullDate(displayCandidate.appliedAt)}>
                    {formatTimeAgo(displayCandidate.appliedAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-2 w-2 rounded-full bg-success" />
                  <div className="w-px flex-1 bg-border" />
                </div>
                <div className="pb-4">
                  <p className="text-sm font-medium text-foreground">
                    AI Screening Complete
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Scored {displayCandidate.aiScore}% match
                  </p>
                </div>
              </div>
              {hasCompletedInterview && interview?.completed_at && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <div className="w-px flex-1 bg-border" />
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-foreground">
                      AI Interview Completed
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Scored {interview.overall_score}% • {interview.recommendation?.replace("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground" title={formatFullDate(interview.completed_at)}>
                      {formatTimeAgo(interview.completed_at)}
                    </p>
                  </div>
                </div>
              )}
              {displayCandidate.status !== "applied" && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Moved to {displayCandidate.status.replace("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground">By recruiter</p>
                  </div>
                </div>
              )}
              {/* Empty state humor */}
              {displayCandidate.status === "applied" && !hasCompletedInterview && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground italic">
                      No more activity yet. The candidate is probably overthinking their cover letter.
                    </p>
                  </div>
                </div>
              )}
            </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Actions */}
        <div className="p-6 border-t border-border space-y-3 shrink-0">
        {/* Show scheduled interview info */}
        {hasScheduledInterview && interview?.scheduled_at && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-primary mb-2">
            <CalendarClock className="h-4 w-4 shrink-0" />
            <div className="text-sm">
              <span className="font-medium">Interview scheduled for </span>
              <span>
                {new Date(interview.scheduled_at).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short', 
                  day: 'numeric',
                })} at {new Date(interview.scheduled_at).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        )}
        <Button 
          className="w-full"
          onClick={() => setScheduleDialogOpen(true)}
          disabled={!jobId}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {hasScheduledInterview ? 'Reschedule Interview' : 'Schedule Interview'}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 bg-transparent">
            <Mail className="mr-2 h-4 w-4" />
            Message
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 text-destructive hover:text-destructive hover:bg-destructive/10 bg-transparent"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Schedule Interview Dialog */}
      {jobId && jobTitle && (
        <ScheduleDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          candidateId={displayCandidate.id}
          candidateName={displayCandidate.name}
          candidateEmail={displayCandidate.email || ""}
          jobId={jobId}
          jobTitle={jobTitle}
          questionGenerationStatus={displayCandidate.questionGenerationStatus || displayCandidate.question_generation_status || "none"}
          onScheduled={handleInterviewScheduled}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">{displayCandidate.name}</span>? 
              This action cannot be undone and will permanently remove the candidate from this job pipeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteCandidate.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCandidate}
              disabled={deleteCandidate.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteCandidate.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
