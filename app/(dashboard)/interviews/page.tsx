"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { format, isToday, isTomorrow } from "date-fns";
import { Calendar, Clock, ExternalLink, MoreHorizontal, User, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScheduledInterviewWithDetails, InterviewStatus } from "@/types";

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

const statusOptions: { value: InterviewStatus; label: string }[] = [
  { value: "scheduled", label: "Scheduled" },
  { value: "ready", label: "Ready" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "expired", label: "Expired" },
  { value: "cancelled", label: "Cancelled" },
];

function InterviewFilters({
  filters,
  onFiltersChange,
}: {
  filters: { status: InterviewStatus[] };
  onFiltersChange: (filters: { status: InterviewStatus[] }) => void;
}) {
  const handleStatusChange = (value: InterviewStatus, checked: boolean) => {
    const newStatus = checked
      ? [...filters.status, value]
      : filters.status.filter((s) => s !== value);
    onFiltersChange({ ...filters, status: newStatus });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-foreground">Status</h4>
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <div key={option.value} className="flex items-center gap-2">
                <Checkbox
                  id={`status-${option.value}`}
                  checked={filters.status.includes(option.value)}
                  onCheckedChange={(checked) =>
                    handleStatusChange(option.value, checked as boolean)
                  }
                />
                <Label
                  htmlFor={`status-${option.value}`}
                  className="text-sm font-normal text-muted-foreground cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InterviewItemSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<ScheduledInterviewWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<{ status: InterviewStatus[] }>({
    status: [],
  });

  useEffect(() => {
    async function fetchInterviews() {
      try {
        setIsLoading(true);
        const statusParams = filters.status.length > 0 
          ? filters.status.map(s => `status=${s}`).join("&")
          : "";
        const url = `/api/interviews/schedule${statusParams ? `?${statusParams}` : ""}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error("Failed to fetch interviews");
        }
        const data = await response.json();
        setInterviews(data.interviews || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load interviews");
      } finally {
        setIsLoading(false);
      }
    }

    fetchInterviews();
  }, [filters.status]);

  const getDateLabel = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEE, MMM d");
  };

  const getTimeLabel = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return format(date, "h:mm a");
  };

  const filteredInterviews = useMemo(() => {
    if (!interviews) return [];
    
    return interviews.filter((interview) => {
      const candidateName = interview.candidate?.full_name?.toLowerCase() || "";
      const jobTitle = interview.job?.title?.toLowerCase() || "";
      const searchLower = searchQuery.toLowerCase();
      
      return (
        candidateName.includes(searchLower) ||
        jobTitle.includes(searchLower)
      );
    });
  }, [interviews, searchQuery]);

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interviews</h1>
          <p className="text-muted-foreground">
            View and manage all scheduled AI interviews
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filters Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <InterviewFilters filters={filters} onFiltersChange={setFilters} />
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by candidate name or job title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Interviews List */}
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <InterviewItemSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <Calendar className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">
                Failed to load interviews
              </h3>
              <p className="text-muted-foreground mb-4">
                {error || "Please try again later"}
              </p>
            </div>
          ) : filteredInterviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">
                No interviews found
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filters.status.length > 0
                  ? "Try adjusting your filters or search query"
                  : "Schedule interviews from the candidate panel"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredInterviews.map((interview) => {
                const candidate = interview.candidate;
                const job = interview.job;
                const scheduledAt = interview.scheduled_at;

                return (
                  <div
                    key={interview.id}
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
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
                          <Link href={`/jobs/${interview.job_id}`}>
                            View Candidate
                          </Link>
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
        </div>
      </div>
    </div>
  );
}
