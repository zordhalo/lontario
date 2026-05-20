import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { ApplyForm } from "@/components/apply/apply-form"

export const metadata: Metadata = {
  title: "Apply | Lontario",
  robots: { index: false, follow: false },
}

type JobSummary = {
  id: string
  title: string
  level: string | null
  location: string | null
  location_type: string | null
}

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("jobs")
    .select("id, title, level, location, location_type")
    .eq("id", jobId)
    .eq("status", "active")
    .eq("is_archived", false)
    .maybeSingle()

  if (error || !data) notFound()
  const job = data as JobSummary

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <nav className="mb-6 text-sm" aria-label="Breadcrumb">
        <Link
          href={`/jobs/${job.id}`}
          className="text-muted-foreground hover:text-foreground"
        >
          ← Back to job
        </Link>
      </nav>

      <header className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Applying for
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {job.title}
        </h1>
        {(job.location || job.location_type) && (
          <p className="text-sm text-muted-foreground">
            {[job.location, job.location_type].filter(Boolean).join(" · ")}
          </p>
        )}
      </header>

      <ApplyForm jobId={job.id} jobTitle={job.title} />
    </div>
  )
}
