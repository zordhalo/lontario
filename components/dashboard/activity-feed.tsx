"use client"

import { useState } from "react"
import {
  ArrowRight,
  Calendar,
  FileCheck,
  Sparkles,
  UserPlus,
  MessageSquare,
  Star,
  FileText,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"
import { useActivities } from "@/hooks/use-activities"
import { ActivityDialog } from "@/components/dashboard/activity-dialog"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

const getActivityIcon = (type: string) => {
  switch (type) {
    case "application_submitted":
      return { icon: UserPlus, color: "text-primary", bg: "bg-primary/10" }
    case "ai_scored":
      return { icon: Sparkles, color: "text-success", bg: "bg-success/10" }
    case "interview_scheduled":
    case "interview_completed":
      return { icon: Calendar, color: "text-warning", bg: "bg-warning/10" }
    case "stage_changed":
      return { icon: FileCheck, color: "text-info", bg: "bg-info/10" }
    case "resume_parsed":
      return { icon: FileText, color: "text-primary", bg: "bg-primary/10" }
    case "starred":
    case "unstarred":
      return { icon: Star, color: "text-warning", bg: "bg-warning/10" }
    case "comment_added":
      return { icon: MessageSquare, color: "text-muted-foreground", bg: "bg-muted" }
    default:
      return { icon: FileCheck, color: "text-muted-foreground", bg: "bg-muted" }
  }
}

function formatTimestamp(timestamp: string): string {
  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  } catch {
    return timestamp
  }
}

export function ActivityFeed() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data, isLoading, error } = useActivities({ limit: 10 })

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load activities</p>
        </CardContent>
      </Card>
    )
  }

  const activities = data?.activities || []

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <Empty className="border-0 py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileCheck className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No Recent Activity</EmptyTitle>
              <EmptyDescription>
                Activity will appear here as candidates apply and progress through your pipeline
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="sm">
                <a href="/jobs/new">Create Job</a>
              </Button>
            </EmptyContent>
          </Empty>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Recent Activity</CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary"
            onClick={() => setDialogOpen(true)}
          >
            View all
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activities.map((activity) => {
              const activityStyle = getActivityIcon(activity.type)
              const initials = activity.candidateName
                ?.split(" ")
                .map((n) => n[0])
                .join("") || "??"

              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback
                      className={cn(
                        "text-xs font-medium",
                        activityStyle.bg,
                        activityStyle.color
                      )}
                    >
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTimestamp(activity.timestamp)}
                    </p>
                  </div>
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      activityStyle.bg
                    )}
                  >
                    <activityStyle.icon
                      className={cn("h-4 w-4", activityStyle.color)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
      <ActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
