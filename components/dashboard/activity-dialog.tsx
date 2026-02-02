"use client"

import {
  Calendar,
  FileCheck,
  Sparkles,
  UserPlus,
  MessageSquare,
  Star,
  FileText,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { useActivities } from "@/hooks/use-activities"
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

interface ActivityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ActivityDialog({ open, onOpenChange }: ActivityDialogProps) {
  const { data, isLoading, error } = useActivities({ limit: 50 })

  const activities = data?.activities || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[70vw] sm:max-w-[70vw] w-[70vw] h-[85vh] max-h-[85vh] p-0 flex flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-xl font-semibold">All Recent Activity</DialogTitle>
          <DialogDescription className="sr-only">
            View all recent activity across your hiring pipeline
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">Failed to load activities</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Empty className="border-0">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileCheck className="h-6 w-6" />
                  </EmptyMedia>
                  <EmptyTitle>No Activity</EmptyTitle>
                  <EmptyDescription>
                    Activity will appear here as candidates apply and progress through your pipeline
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => {
                const activityStyle = getActivityIcon(activity.type)
                const initials = activity.candidateName
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("") || "??"

                return (
                  <div key={activity.id} className="flex items-start gap-3">
                    <Avatar className="h-9 w-9 shrink-0">
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
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimestamp(activity.timestamp)}
                      </p>
                    </div>
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full shrink-0",
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
