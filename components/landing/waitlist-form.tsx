"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import * as Sentry from "@sentry/nextjs";
import { Loader2, ArrowRight, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const waitlistSchema = z.object({
  email: z.string().email("That doesn't look like an email."),
});

type WaitlistFormData = z.infer<typeof waitlistSchema>;

interface WaitlistFormProps {
  className?: string;
  /** Source tag sent with the signup. Defaults to "landing". */
  source?: string;
}

export function WaitlistForm({ className, source = "landing" }: WaitlistFormProps) {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: WaitlistFormData) => {
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, source }),
      });

      if (res.status === 429) {
        toast.error("Easy there. Try again in a bit.");
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        Sentry.captureException(
          new Error(`Waitlist signup failed: ${res.status}`),
          { extra: { status: res.status, body, source } }
        );
        toast.error("Something broke. Try again?");
        return;
      }

      toast.success("You're on the list.");
      setSubmitted(true);
      reset();
    } catch (err) {
      Sentry.captureException(err, { extra: { source } });
      toast.error("Something broke. Try again?");
    }
  };

  if (submitted) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-foreground",
          className
        )}
        role="status"
        aria-live="polite"
      >
        <CheckCircle2 className="h-4 w-4 text-accent shrink-0" aria-hidden />
        <span>
          You&apos;re #51 in the mock-profile lineup. We&apos;ll be in touch.
        </span>
      </div>
    );
  }

  const errorId = "waitlist-email-error";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={cn("w-full max-w-md", className)}
      noValidate
    >
      <Label htmlFor="waitlist-email" className="sr-only">
        Email address
      </Label>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          id="waitlist-email"
          type="email"
          autoComplete="email"
          placeholder="you@startup.dev"
          className="h-12 text-base flex-1"
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? errorId : undefined}
          disabled={isSubmitting}
          {...register("email")}
        />
        <Button
          type="submit"
          size="lg"
          disabled={isSubmitting}
          className="h-12 px-6 bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm font-semibold"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Submitting
            </>
          ) : (
            <>
              Get notified
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </>
          )}
        </Button>
      </div>
      {errors.email ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-sm text-destructive"
        >
          {errors.email.message}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Drop your email and become #51 in the mock-profile lineup. No spam, mostly because we forgot to set up an ESP.
        </p>
      )}
    </form>
  );
}
