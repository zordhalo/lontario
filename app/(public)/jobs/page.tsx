import Link from "next/link"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Open jobs | Lontario",
  description:
    "Roles currently open. Apply with your GitHub and a resume — no recruiter screen, no hoops.",
}

// Always fetch fresh — jobs flip on/off and we don't want stale lists.
export const revalidate = 60

type JobListItem = {
  id: string
  title: string
  level: string | null
  location: string | null
  location_type: string | null
  employment_type: string | null
  published_at: string | null
  created_at: string
}

function formatDate(value: string | null): string {
  if (!value) return ""
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

function prettifyLevel(level: string | null): string | null {
  if (!level) return null
  return level.charAt(0).toUpperCase() + level.slice(1)
}

function prettifyEmployment(value: string | null): string | null {
  if (!value) return null
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("-")
}

function composeLocation(
  location: string | null,
  locationType: string | null
): string | null {
  if (location && locationType) return `${location} · ${locationType}`
  return location || locationType
}

export default async function PublicJobsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, title, level, location, location_type, employment_type, published_at, created_at"
    )
    .eq("status", "active")
    .eq("is_archived", false)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  const jobs: JobListItem[] = (data as JobListItem[] | null) ?? []

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Open jobs
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Roles a human (one human) is actively reviewing. Apply with a GitHub
          link and we&apos;ll take it from there.
        </p>
      </header>

      {error ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Couldn&apos;t load jobs right now. Refresh in a sec.
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <p className="text-base font-medium text-foreground">
              No openings right now.
            </p>
            <p className="text-sm text-muted-foreground">
              Want a heads-up when something opens?{" "}
              <Link
                href="/#waitlist"
                className="font-medium text-accent underline-offset-4 hover:underline"
              >
                Join the waitlist
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3" aria-label="Open jobs">
          {jobs.map((job) => {
            const level = prettifyLevel(job.level)
            const employment = prettifyEmployment(job.employment_type)
            const loc = composeLocation(job.location, job.location_type)
            const posted = formatDate(job.published_at || job.created_at)
            return (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="group block rounded-lg border border-border bg-card transition-colors hover:border-accent/60 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <h2 className="text-lg font-semibold text-foreground transition-colors group-hover:text-accent">
                        {job.title}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        {level && (
                          <Badge variant="secondary" className="font-normal">
                            {level}
                          </Badge>
                        )}
                        {employment && (
                          <Badge variant="outline" className="font-normal">
                            {employment}
                          </Badge>
                        )}
                        {loc && (
                          <span className="text-xs text-muted-foreground">
                            {loc}
                          </span>
                        )}
                      </div>
                    </div>
                    {posted && (
                      <p className="text-xs text-muted-foreground sm:text-right">
                        Posted {posted}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
