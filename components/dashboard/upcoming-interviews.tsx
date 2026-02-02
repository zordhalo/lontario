"use client";

import { useEffect, useState } from "react";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import {
  Calendar,
  Clock,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import type { ScheduledInterviewWithDetails, InterviewStatus } from "@/types";

interface UpcomingInterviewsSectionProps {
  className?: string;
}

const statusColors: Record<InterviewStatus, string> = {
  pending: "bg-gray-100 text-gray-800",
  scheduled: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  sent: "bg-blue-100 text-blue-800",
  in_progress: "bg-amber-100 text-amber-800",
  completed: "bg-green-100 text-green-800",
  expired: "bg-red-100 text-red-800",
  abandoned: "bg-gray-100 text-gray-800",
  missed: "bg-red-100 text-red-800",
  cancelled: "bg-gray-100 text-gray-800",
};

function InterviewItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

export function UpcomingInterviewsSection({
  className,
}: UpcomingInterviewsSectionProps) {
  const [interviews, setInterviews] = useState<ScheduledInterviewWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUpcomingInterviews() {
      try {
        const response = await fetch("/api/interviews/schedule?status=scheduled&limit=5");
        if (!response.ok) {
          throw new Error("Failed to fetch interviews");
        }
        const data = await response.json();
        setInterviews(data.interviews || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load interviews");
      } finally {
        setIsLoading(false);
      }
    }

    fetchUpcomingInterviews();
  }, []);

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  const getTimeLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    return format(date, "h:mm a");
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming AI Interviews
          </CardTitle>
          <CardDescription>Scheduled interviews for the next 7 days</CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <a href="/interviews">View all</a>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <InterviewItemSkeleton />
            <InterviewItemSkeleton />
            <InterviewItemSkeleton />
          </div>
        ) : error ? (
          <div className="text-center py-6 text-muted-foreground">
            <p>{error}</p>
          </div>
        ) : interviews.length === 0 ? (
          <Empty className="border-0 py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Calendar className="h-6 w-6" />
              </EmptyMedia>
              <EmptyTitle>No Upcoming Interviews</EmptyTitle>
              <EmptyDescription>
                Schedule AI-powered interviews from the candidate panel
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild size="sm">
                <a href="/jobs">View Candidates</a>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="space-y-3">
            {interviews.map((interview) => {
              const candidate = interview.candidate;
              const job = interview.job;
              const scheduledAt = interview.scheduled_at;

              return (
                <div
                  key={interview.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-primary" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {candidate?.full_name || "Unknown Candidate"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {job?.title || "Unknown Position"}
                    </p>
                  </div>

                  {/* Time */}
                  <div className="text-right shrink-0">
                    {scheduledAt && (
                      <>
                        <p className="text-sm font-medium">
                          {getDateLabel(scheduledAt)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {getTimeLabel(scheduledAt)}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Status */}
                  <Badge
                    variant="secondary"
                    className={cn("shrink-0 text-xs", statusColors[interview.status])}
                  >
                    {interview.status === "in_progress"
                      ? "In Progress"
                      : interview.status.charAt(0).toUpperCase() + interview.status.slice(1)}
                  </Badge>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <a href={`/jobs/${interview.job_id}`}>
                          View Candidate
                        </a>
                      </DropdownMenuItem>
                      {interview.interview_link && (
                        <DropdownMenuItem asChild>
                          <a
                            href={interview.interview_link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Open Interview Link
                          </a>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
