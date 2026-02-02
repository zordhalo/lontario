"use client"

import { Briefcase, CheckCircle, Sparkles, Users } from "lucide-react"
import { StatsCard } from "@/components/stats-card"
import { AlertsSection } from "@/components/dashboard/alerts-section"
import { PipelineSection } from "@/components/dashboard/pipeline-section"
import { ActivityFeed } from "@/components/dashboard/activity-feed"
import { UpcomingInterviewsSection } from "@/components/dashboard/upcoming-interviews"
import { useDashboardStats } from "@/hooks/use-dashboard"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

function StatsCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useDashboardStats()

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back!
          </h1>
          <p className="text-muted-foreground">
            {"Here's what's happening with your recruiting pipeline."}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {isLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : error ? (
          <>
            <StatsCard
              title="Active Jobs"
              value="--"
              icon={Briefcase}
            />
            <StatsCard
              title="New Applications"
              value="--"
              icon={Users}
            />
            <StatsCard
              title="AI Matches Today"
              value="--"
              icon={Sparkles}
            />
            <StatsCard
              title="Hired This Week"
              value="--"
              icon={CheckCircle}
            />
          </>
        ) : (
          <>
            <StatsCard
              title="Active Jobs"
              value={stats?.active_jobs.value ?? 0}
              icon={Briefcase}
              trend={stats?.active_jobs.trend !== undefined ? {
                value: Math.abs(stats.active_jobs.trend),
                isPositive: stats.active_jobs.trend >= 0,
              } : undefined}
            />
            <StatsCard
              title="New Applications"
              value={stats?.new_applications.value ?? 0}
              icon={Users}
              trend={stats?.new_applications.trend !== undefined ? {
                value: Math.abs(stats.new_applications.trend),
                isPositive: stats.new_applications.trend >= 0,
              } : undefined}
            />
            <StatsCard
              title="AI Matches Today"
              value={stats?.ai_matches_today.value ?? 0}
              icon={Sparkles}
              trend={stats?.ai_matches_today.trend !== undefined ? {
                value: Math.abs(stats.ai_matches_today.trend),
                isPositive: stats.ai_matches_today.trend >= 0,
              } : undefined}
            />
            <StatsCard
              title="Hired This Week"
              value={stats?.hired_this_week.value ?? 0}
              icon={CheckCircle}
              trend={stats?.hired_this_week.trend !== undefined ? {
                value: Math.abs(stats.hired_this_week.trend),
                isPositive: stats.hired_this_week.trend >= 0,
              } : undefined}
            />
          </>
        )}
      </div>

      {/* Alerts Section */}
      <AlertsSection className="mb-8" />

      {/* Upcoming Interviews */}
      <UpcomingInterviewsSection className="mb-8" />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PipelineSection />
        <ActivityFeed />
      </div>
    </div>
  )
}
