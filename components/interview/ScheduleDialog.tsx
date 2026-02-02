"use client";

import * as React from "react";
import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobId: string;
  jobTitle: string;
  questionGenerationStatus?: "none" | "pending" | "generating" | "ready" | "failed";
  onScheduled?: (interview: {
    id: string;
    scheduled_at: string;
    interview_link: string;
  }) => void;
}

// Generate time slots (every 30 minutes)
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      const label =
        hour < 12
          ? `${hour === 0 ? 12 : hour}:${m} AM`
          : `${hour === 12 ? 12 : hour - 12}:${m} PM`;
      slots.push({ value: `${h}:${m}`, label });
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

const DURATION_OPTIONS = [
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "60 minutes" },
];

export function ScheduleDialog({
  open,
  onOpenChange,
  candidateId,
  candidateName,
  candidateEmail,
  jobId,
  jobTitle,
  questionGenerationStatus = "none",
  onScheduled,
}: ScheduleDialogProps) {
  const hasPreGeneratedQuestions = questionGenerationStatus === "ready";
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>("09:00");
  const [duration, setDuration] = useState<string>("30");
  const [customMessage, setCustomMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get user's timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleSchedule = async () => {
    if (!date) {
      setError("Please select a date");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Combine date and time
      const [hours, minutes] = time.split(":").map(Number);
      const scheduledDate = new Date(date);
      scheduledDate.setHours(hours, minutes, 0, 0);

      // Validate it's in the future
      if (scheduledDate <= new Date()) {
        setError("Please select a future date and time");
        setIsLoading(false);
        return;
      }

      const response = await fetch("/api/interviews/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidate_id: candidateId,
          job_id: jobId,
          scheduled_at: scheduledDate.toISOString(),
          duration_minutes: parseInt(duration),
          send_immediate_invite: true,
          custom_message: customMessage || undefined,
          candidate_timezone: timezone,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to schedule interview");
      }

      const data = await response.json();

      // Call the onScheduled callback
      if (onScheduled) {
        onScheduled({
          id: data.interview.id,
          scheduled_at: data.interview.scheduled_at,
          interview_link: data.interview_link,
        });
      }

      // Reset form and close dialog
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule interview");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setDate(undefined);
    setTime("09:00");
    setDuration("30");
    setCustomMessage("");
    setError(null);
  };

  // Format the preview date/time
  const getPreviewDateTime = () => {
    if (!date) return null;
    const [hours, minutes] = time.split(":").map(Number);
    const previewDate = new Date(date);
    previewDate.setHours(hours, minutes, 0, 0);
    return format(previewDate, "EEEE, MMMM d, yyyy 'at' h:mm a");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Schedule AI Interview
            {hasPreGeneratedQuestions && (
              <span className="inline-flex items-center gap-1 text-xs font-normal px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                <Zap className="h-3 w-3" />
                Instant
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Schedule an AI-powered interview for {candidateName} for the{" "}
            {jobTitle} position.
            {hasPreGeneratedQuestions && (
              <span className="block mt-1 text-green-600 dark:text-green-400">
                Questions are pre-generated — scheduling will be instant!
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : "Select a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(selectedDate) => setDate(selectedDate)}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label>Time</Label>
            <Select value={time} onValueChange={setTime}>
              <SelectTrigger className="w-full">
                <div className="flex items-center">
                  <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select time" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Timezone: {timezone}
            </p>
          </div>

          {/* Duration Selector */}
          <div className="space-y-2">
            <Label>Interview Duration</Label>
            <RadioGroup
              value={duration}
              onValueChange={setDuration}
              className="flex gap-4"
            >
              {DURATION_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={option.value} id={`duration-${option.value}`} />
                  <Label
                    htmlFor={`duration-${option.value}`}
                    className="font-normal cursor-pointer"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Custom Message */}
          <div className="space-y-2">
            <Label htmlFor="custom-message">
              Custom Message <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="custom-message"
              placeholder="Add a personal message to include in the interview invitation email..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              maxLength={1000}
            />
          </div>

          {/* Preview */}
          {date && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Interview Summary</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium text-foreground">Candidate:</span>{" "}
                  {candidateName} ({candidateEmail})
                </p>
                <p>
                  <span className="font-medium text-foreground">Position:</span>{" "}
                  {jobTitle}
                </p>
                <p>
                  <span className="font-medium text-foreground">Scheduled:</span>{" "}
                  {getPreviewDateTime()}
                </p>
                <p>
                  <span className="font-medium text-foreground">Duration:</span>{" "}
                  {duration} minutes
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSchedule} disabled={isLoading || !date}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              "Schedule Interview"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
