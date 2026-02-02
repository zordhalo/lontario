"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Archive,
  ArchiveRestore,
  Edit,
  ExternalLink,
  MapPin,
  MoreHorizontal,
  Sparkles,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { useArchiveJob, useUnarchiveJob } from "@/hooks/use-jobs"
import { useToast } from "@/hooks/use-toast"
import type { Job, StageCounts } from "@/lib/mock-data"

interface JobCardProps {
  job: Job
  variant?: "grid" | "list"
}

const statusColors = {
  active: "bg-success/10 text-success border-success/30",
  draft: "bg-warning/10 text-warning border-warning/30",
  closed: "bg-muted text-muted-foreground border-border",
}

// Calculate pipeline progress from real stage data
// Progress is calculated as a weighted average based on how far through the pipeline each applicant is
function calculatePipelineProgress(stageCounts: StageCounts | undefined, totalApplicants: number): number {
  if (!stageCounts || totalApplicants === 0) {
    return 0
  }

  // Define progress percentage for each stage (0-100%)
  const stageProgress: Record<string, number> = {
    applied: 0,
    screening: 15,
    ai_interview: 30,
    phone_screen: 45,
    technical: 60,
    onsite: 75,
    offer: 90,
    hired: 100,
  }

  // Calculate weighted average: sum(count * progress) / total
  let totalProgress = 0
  for (const [stage, count] of Object.entries(stageCounts)) {
    const progress = stageProgress[stage] || 0
    totalProgress += (count || 0) * progress
  }

  return Math.round(totalProgress / totalApplicants)
}

// Get counts for display in the progress bar breakdown
function getStageBreakdown(stageCounts: StageCounts | undefined): { 
  applied: number
  screened: number
  interview: number
} {
  if (!stageCounts) {
    return { applied: 0, screened: 0, interview: 0 }
  }

  return {
    applied: stageCounts.applied || 0,
    screened: (stageCounts.screening || 0),
    interview: (stageCounts.ai_interview || 0) + 
               (stageCounts.phone_screen || 0) + 
               (stageCounts.technical || 0) + 
               (stageCounts.onsite || 0) +
               (stageCounts.offer || 0) +
               (stageCounts.hired || 0),
  }
}

export function JobCard({ job, variant = "grid" }: JobCardProps) {
  const stageCounts = job.stageCounts || job.stage_counts
  const progress = calculatePipelineProgress(stageCounts, job.applicants)
  const breakdown = getStageBreakdown(stageCounts)

  if (variant === "list") {
    return (
      <Card className={cn(
        "group hover:border-primary/30 transition-colors",
        job.isArchived && "opacity-60"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <Link
                  href={`/jobs/${job.id}`}
                  className="text-lg font-medium text-foreground hover:text-primary transition-colors truncate"
                >
                  {job.title}
                </Link>
                <Badge
                  variant="outline"
                  className={cn("capitalize shrink-0", statusColors[job.status])}
                >
                  {job.status}
                </Badge>
                {job.isArchived && (
                  <Badge variant="outline" className="shrink-0 bg-muted text-muted-foreground">
                    Archived
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{job.department}</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {job.location}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {job.applicants} applicants
                </span>
                {job.topMatches > 0 && (
                  <span className="flex items-center gap-1 text-success">
                    <Sparkles className="h-3.5 w-3.5" />
                    {job.topMatches} top matches
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/jobs/${job.id}`}>
                <Button variant="outline" size="sm">
                  View
                </Button>
              </Link>
              <JobActions job={job} />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Card className={cn(
        "group hover:border-primary/30 hover:shadow-md transition-all duration-200",
        "hover:-translate-y-1",
        job.isArchived && "opacity-60"
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="text-lg font-medium text-foreground hover:text-primary transition-colors line-clamp-1 block"
                  >
                    {job.title}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]">
                  <p>{job.title}</p>
                </TooltipContent>
              </Tooltip>
              <p className="text-sm text-muted-foreground">{job.department}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge
                variant="outline"
                className={cn("capitalize shrink-0", statusColors[job.status])}
              >
                {job.status}
              </Badge>
              {job.isArchived && (
                <Badge variant="outline" className="shrink-0 bg-muted text-muted-foreground text-xs">
                  Archived
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            {job.location}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{job.applicants}</span>
            <span className="text-muted-foreground">applicants</span>
          </div>
          {job.topMatches > 0 && (
            <div className="flex items-center gap-1 text-success">
              <Sparkles className="h-4 w-4" />
              <span className="font-medium">{job.topMatches}</span>
              <span className="text-success/80">top matches</span>
            </div>
          )}
        </div>

        {job.status === "active" && job.applicants > 0 && (
          <div className="space-y-2">
            <Progress value={progress} className="h-1.5" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pipeline progress</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Link href={`/jobs/${job.id}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full bg-transparent hover:bg-primary/5 hover:border-primary/30">
              View Candidates
            </Button>
          </Link>
          <JobActions job={job} />
        </div>
      </CardContent>
    </Card>
    </TooltipProvider>
  )
}

function JobActions({ job }: { job: Job }) {
  const [showArchiveDialog, setShowArchiveDialog] = useState(false)
  const archiveJob = useArchiveJob()
  const unarchiveJob = useUnarchiveJob()
  const { toast } = useToast()

  const isArchived = job.isArchived

  const handleArchive = async () => {
    try {
      await archiveJob.mutateAsync(job.id)
      toast({
        title: "Job archived",
        description: `"${job.title}" has been archived and will no longer appear in the default job list.`,
      })
    } catch (error) {
      toast({
        title: "Failed to archive job",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    }
    setShowArchiveDialog(false)
  }

  const handleUnarchive = async () => {
    try {
      await unarchiveJob.mutateAsync(job.id)
      toast({
        title: "Job restored",
        description: `"${job.title}" has been restored and is now visible in the job list.`,
      })
    } catch (error) {
      toast({
        title: "Failed to restore job",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">More actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/jobs/${job.id}`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Job
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <ExternalLink className="mr-2 h-4 w-4" />
            Share Link
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isArchived ? (
            <DropdownMenuItem onClick={handleUnarchive}>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => setShowArchiveDialog(true)}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive this job?</AlertDialogTitle>
            <AlertDialogDescription>
              Archiving &quot;{job.title}&quot; will hide it from the default job list. 
              You can still view archived jobs by enabling the &quot;Show archived&quot; filter. 
              This action can be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleArchive}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
