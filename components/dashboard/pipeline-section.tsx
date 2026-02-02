"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowRight, Briefcase } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { useJobs } from "@/hooks/use-jobs"
import { normalizeJob, type StageCounts } from "@/lib/mock-data"

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

// Get counts for display
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
    screened: stageCounts.screening || 0,
    interview: (stageCounts.ai_interview || 0) + 
               (stageCounts.phone_screen || 0) + 
               (stageCounts.technical || 0) + 
               (stageCounts.onsite || 0) +
               (stageCounts.offer || 0) +
               (stageCounts.hired || 0),
  }
}

export function PipelineSection() {
  const { data, isLoading, error } = useJobs({ status: "active" })

  const activeJobs = useMemo(() => {
    if (!data?.jobs) return []
    return data.jobs.map(normalizeJob).slice(0, 4)
  }, [data?.jobs])

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Active Jobs Pipeline</CardTitle>
          <Link href="/jobs">
            <Button variant="ghost" size="sm" className="text-primary">
              View all
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Active Jobs Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load jobs</p>
        </CardContent>
      </Card>
    )
  }

  if (activeJobs.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Active Jobs Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty className="border-0 py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Briefcase className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No Active Jobs</EmptyTitle>
              <EmptyDescription>
                Create your first job posting to start receiving applications
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="sm">
                <Link href="/jobs/new">Create Job</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-lg">Active Jobs Pipeline</CardTitle>
        <Link href="/jobs">
          <Button variant="ghost" size="sm" className="text-primary">
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeJobs.map((job) => {
          const stageCounts = job.stageCounts || job.stage_counts
          const progress = calculatePipelineProgress(stageCounts, job.applicants)
          const breakdown = getStageBreakdown(stageCounts)

          return (
            <Link
              key={job.id}
              href={`/jobs/${job.id}`}
              className="block group"
            >
              <div className="p-4 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {job.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {job.applicants} applicants
                      {job.topMatches > 0 &&
                        ` • ${job.topMatches} top matches`}
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Pipeline progress
                    </span>
                    <span className="font-medium text-foreground">
                      {progress}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Applied: {breakdown.applied}</span>
                    <span>Screened: {breakdown.screened}</span>
                    <span>Interview: {breakdown.interview}</span>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
