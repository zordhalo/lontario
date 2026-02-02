"use client";

import * as React from "react";
import { useState } from "react";
import { formatDistanceToNow, format, isPast, isFuture } from "date-fns";
import {
  Calendar,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  XCircle,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import type { AIInterview, InterviewStatus } from "@/types";

interface ScheduledStatusCardProps {
  interview: AIInterview;
  onReschedule?: () => void;
  onCancelled?: () => void;
  className?: string;
}

const statusConfig: Record<
  InterviewStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string }
> = {
  pending: { label: "Pending", variant: "secondary", color: "bg-gray-500" },
  scheduled: { label: "Scheduled", variant: "default", color: "bg-blue-500" },
  ready: { label: "Ready", variant: "default", color: "bg-green-500" },
  sent: { label: "Sent", variant: "secondary", color: "bg-blue-400" },
  in_progress: { label: "In Progress", variant: "default", color: "bg-amber-500" },
  completed: { label: "Completed", variant: "secondary", color: "bg-green-600" },
  expired: { label: "Expired", variant: "destructive", color: "bg-red-500" },
  abandoned: { label: "Abandoned", variant: "destructive", color: "bg-gray-600" },
  missed: { label: "Missed", variant: "destructive", color: "bg-red-400" },
  cancelled: { label: "Cancelled", variant: "outline", color: "bg-gray-400" },
};

export function ScheduledStatusCard({
  interview,
  onReschedule,
  onCancelled,
  className,
}: ScheduledStatusCardProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const { toast } = useToast();

  const scheduledDate = interview.scheduled_at
    ? new Date(interview.scheduled_at)
    : null;
  const status = statusConfig[interview.status] || statusConfig.pending;

  const handleCopyLink = async () => {
    if (interview.interview_link) {
      await navigator.clipboard.writeText(interview.interview_link);
      toast({
        title: "Link Copied",
        description: "Interview link copied to clipboard",
      });
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/interviews/${interview.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to cancel interview");
      }

      toast({
        title: "Interview Cancelled",
        description: "The interview has been cancelled",
      });

      setCancelDialogOpen(false);
      onCancelled?.();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel the interview",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const getTimeDisplay = () => {
    if (!scheduledDate) return null;

    if (isPast(scheduledDate)) {
      if (interview.status === "completed") {
        return `Completed ${formatDistanceToNow(scheduledDate, { addSuffix: true })}`;
      }
      return `Was scheduled ${formatDistanceToNow(scheduledDate, { addSuffix: true })}`;
    }

    return `Starts ${formatDistanceToNow(scheduledDate, { addSuffix: true })}`;
  };

  const canCancel = ["scheduled", "ready", "pending"].includes(interview.status);
  const canReschedule = ["scheduled", "ready", "pending"].includes(interview.status);

  return (
    <>
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                AI Interview
              </CardTitle>
              <CardDescription>{getTimeDisplay()}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={status.variant}>{status.label}</Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {interview.interview_link && (
                    <DropdownMenuItem onClick={handleCopyLink}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Interview Link
                    </DropdownMenuItem>
                  )}
                  {interview.interview_link && (
                    <DropdownMenuItem asChild>
                      <a
                        href={interview.interview_link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Interview Page
                      </a>
                    </DropdownMenuItem>
                  )}
                  {canReschedule && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onReschedule}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Reschedule
                      </DropdownMenuItem>
                    </>
                  )}
                  {canCancel && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setCancelDialogOpen(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Cancel Interview
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {scheduledDate && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{format(scheduledDate, "EEE, MMM d, yyyy")}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{format(scheduledDate, "h:mm a")}</span>
              </div>
            </div>
          )}

          {interview.interview_duration_minutes && (
            <div className="text-sm text-muted-foreground">
              Duration: {interview.interview_duration_minutes} minutes
            </div>
          )}

          {interview.status === "completed" && interview.overall_score !== null && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Score</span>
                <span
                  className={cn(
                    "text-lg font-bold",
                    interview.overall_score >= 70
                      ? "text-green-600"
                      : interview.overall_score >= 50
                        ? "text-amber-600"
                        : "text-red-600"
                  )}
                >
                  {interview.overall_score}%
                </span>
              </div>
              {interview.ai_summary && (
                <p className="text-sm text-muted-foreground mt-2">
                  {interview.ai_summary}
                </p>
              )}
            </div>
          )}

          {interview.status === "in_progress" && (
            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  Interview in progress ({interview.questions_answered || 0}/
                  {interview.total_questions} questions answered)
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Interview?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the scheduled AI interview. The candidate will be
              notified about the cancellation. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Keep Interview
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Interview"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
