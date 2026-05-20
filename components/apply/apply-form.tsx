"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import * as Sentry from "@sentry/nextjs"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { ResumeUploader, MAX_RESUME_BYTES } from "./resume-uploader"

// Strict-shape GitHub URL: https://github.com/<username> with no extra path.
// Allows trailing slash. Username rules: 1-39 chars, alphanumerics + hyphens,
// can't start/end with hyphen.
const GITHUB_USERNAME_RE =
  /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/

function isStrictGitHubProfileUrl(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false
  if (url.host.toLowerCase() !== "github.com") return false
  const path = url.pathname.replace(/^\/+|\/+$/g, "")
  if (!path) return false
  if (path.includes("/")) return false
  return GITHUB_USERNAME_RE.test(path)
}

export const applyFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Tell us your name (at least 2 characters).")
    .max(120, "Keep it under 120 characters."),
  email: z
    .string()
    .trim()
    .email("That doesn't look like a valid email.")
    .max(320, "Email is too long."),
  github_url: z
    .string()
    .trim()
    .min(1, "GitHub profile is required.")
    .refine(
      isStrictGitHubProfileUrl,
      "Use the format https://github.com/<your-username>."
    ),
  linkedin_url: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => {
      if (!v) return true
      try {
        const u = new URL(v)
        return /(^|\.)linkedin\.com$/i.test(u.host)
      } catch {
        return false
      }
    }, "LinkedIn URL must be on linkedin.com."),
  portfolio_url: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => {
      if (!v) return true
      try {
        const u = new URL(v)
        return u.protocol === "https:" || u.protocol === "http:"
      } catch {
        return false
      }
    }, "Portfolio must be a valid URL."),
  cover_letter: z
    .string()
    .max(5000, "Cover letter can't exceed 5,000 characters.")
    .optional()
    .or(z.literal("")),
})

export type ApplyFormValues = z.infer<typeof applyFormSchema>

interface ApplyFormProps {
  jobId: string
  jobTitle: string
}

type ApiErrorShape = {
  error?: string
  message?: string
  code?: string
  details?: Record<string, string[] | string | undefined>
}

const FIELD_KEYS: (keyof ApplyFormValues)[] = [
  "full_name",
  "email",
  "github_url",
  "linkedin_url",
  "portfolio_url",
  "cover_letter",
]

export function ApplyForm({ jobId, jobTitle }: ApplyFormProps) {
  const router = useRouter()
  const [resume, setResume] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<ApplyFormValues>({
    resolver: zodResolver(applyFormSchema),
    defaultValues: {
      full_name: "",
      email: "",
      github_url: "",
      linkedin_url: "",
      portfolio_url: "",
      cover_letter: "",
    },
    mode: "onBlur",
  })

  async function uploadResume(
    file: File
  ): Promise<{ path: string; filename: string }> {
    // Request a signed upload URL from the server.
    const urlRes = await fetch("/api/public/resume-upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size: file.size,
      }),
    })

    if (!urlRes.ok) {
      let detail = ""
      try {
        const body = (await urlRes.json()) as ApiErrorShape
        detail = body?.error || body?.message || ""
      } catch {
        // ignore
      }
      throw new Error(detail || "Couldn't prepare the resume upload.")
    }

    const { upload_url, path, method } = (await urlRes.json()) as {
      upload_url: string
      path: string
      method?: string
    }

    const putRes = await fetch(upload_url, {
      method: method || "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    })
    if (!putRes.ok) {
      throw new Error("Resume upload failed. Check your connection and retry.")
    }
    return { path, filename: file.name }
  }

  function applyServerFieldErrors(details: ApiErrorShape["details"]): boolean {
    if (!details) return false
    let applied = false
    for (const key of FIELD_KEYS) {
      const raw = details[key]
      if (!raw) continue
      const message = Array.isArray(raw) ? raw[0] : raw
      if (typeof message === "string" && message.length > 0) {
        form.setError(key, { type: "server", message })
        applied = true
      }
    }
    return applied
  }

  const onSubmit = async (values: ApplyFormValues) => {
    setSubmitting(true)
    try {
      let resumePath: string | null = null
      let resumeFilename: string | null = null

      if (resume) {
        // Belt-and-suspenders: re-check size before upload.
        if (resume.size > MAX_RESUME_BYTES) {
          toast.error("Resume is over 10 MB. Remove it or pick a smaller file.")
          setSubmitting(false)
          return
        }
        try {
          const uploaded = await uploadResume(resume)
          resumePath = uploaded.path
          resumeFilename = uploaded.filename
        } catch (uploadErr) {
          const message =
            uploadErr instanceof Error
              ? uploadErr.message
              : "Resume upload failed."
          toast.error(message, {
            description:
              "You can also submit without a resume — your GitHub is enough to get started.",
          })
          setSubmitting(false)
          return
        }
      }

      const payload = {
        job_id: jobId,
        full_name: values.full_name,
        email: values.email,
        github_url: values.github_url,
        linkedin_url: values.linkedin_url || undefined,
        portfolio_url: values.portfolio_url || undefined,
        cover_letter: values.cover_letter || undefined,
        resume_path: resumePath || undefined,
        resume_filename: resumeFilename || undefined,
        source: "public_apply",
      }

      const res = await fetch("/api/public/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.status === 201 || res.status === 200) {
        router.push(
          `/apply/${jobId}/success?email=${encodeURIComponent(values.email)}`
        )
        return
      }

      let body: ApiErrorShape = {}
      try {
        body = (await res.json()) as ApiErrorShape
      } catch {
        // ignore non-JSON
      }

      if (res.status === 409) {
        toast.info("Looks like you've already applied — we'll be in touch.")
        return
      }

      if (res.status === 429) {
        const retryAfter = res.headers.get("retry-after")
        const seconds = retryAfter ? Number(retryAfter) : NaN
        const desc =
          Number.isFinite(seconds) && seconds > 0
            ? `Try again in ${Math.ceil(seconds)}s.`
            : undefined
        toast.error("Slow down a sec, then try again.", { description: desc })
        return
      }

      if (res.status >= 400 && res.status < 500) {
        const appliedFieldErrors = applyServerFieldErrors(body.details)
        if (!appliedFieldErrors) {
          toast.error(
            body.error || body.message || "Couldn't submit your application."
          )
        }
        return
      }

      // 5xx
      Sentry.captureException(
        new Error(`apply submit failed: ${res.status}`),
        {
          tags: { area: "public_apply" },
          extra: { jobId, jobTitle, status: res.status, body },
        }
      )
      toast.error("Something broke on our end. Try again in a minute.")
    } catch (err) {
      Sentry.captureException(err, {
        tags: { area: "public_apply" },
        extra: { jobId, jobTitle },
      })
      toast.error("Network hiccup — your application didn't go through.", {
        description: "Check your connection and try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate
      >
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Full name <span aria-hidden="true">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  placeholder="Jane Doe"
                  aria-required="true"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Email <span aria-hidden="true">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  aria-required="true"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="github_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                GitHub profile <span aria-hidden="true">*</span>
              </FormLabel>
              <FormControl>
                <Input
                  type="url"
                  autoComplete="url"
                  inputMode="url"
                  placeholder="https://github.com/yourusername"
                  aria-required="true"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Just your profile URL — no repo paths or anchors.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="linkedin_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>LinkedIn</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  autoComplete="url"
                  inputMode="url"
                  placeholder="https://linkedin.com/in/you"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="portfolio_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Portfolio or website</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  autoComplete="url"
                  inputMode="url"
                  placeholder="https://yoursite.com"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="cover_letter"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cover letter</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  maxLength={5000}
                  placeholder="Anything you want the recruiter to know."
                  {...field}
                />
              </FormControl>
              <FormDescription>Up to 5,000 characters.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <ResumeUploader
          value={resume}
          onChange={setResume}
          disabled={submitting}
        />

        <div className="flex flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-full sm:min-w-[12rem]"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit application"
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
