import Link from "next/link"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

type JobDetail = {
  id: string
  title: string
  description: string
  level: string | null
  location: string | null
  location_type: string | null
  employment_type: string | null
  required_skills: string[] | null
  nice_to_have_skills: string[] | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string | null
  show_salary: boolean | null
  published_at: string | null
  created_at: string
  status: string
  is_archived: boolean
}

async function fetchJob(id: string): Promise<JobDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, title, description, level, location, location_type, employment_type, required_skills, nice_to_have_skills, salary_min, salary_max, salary_currency, show_salary, published_at, created_at, status, is_archived"
    )
    .eq("id", id)
    .eq("status", "active")
    .eq("is_archived", false)
    .maybeSingle()

  if (error || !data) return null
  return data as JobDetail
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const job = await fetchJob(id)
  if (!job) {
    return {
      title: "Job not found | Lontario",
      robots: { index: false, follow: false },
    }
  }
  const description = (job.description || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160)
  return {
    title: `${job.title} | Lontario`,
    description: description || `Apply to ${job.title} on Lontario.`,
  }
}

function formatDate(value: string | null): string | null {
  if (!value) return null
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return null
  }
}

function prettify(value: string | null): string | null {
  if (!value) return null
  return value
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("-")
}

function formatSalary(job: JobDetail): string | null {
  if (!job.show_salary) return null
  if (job.salary_min == null && job.salary_max == null) return null
  const currency = job.salary_currency || "USD"
  const fmt = (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n)
  if (job.salary_min != null && job.salary_max != null) {
    return `${fmt(job.salary_min)} – ${fmt(job.salary_max)}`
  }
  return fmt((job.salary_min ?? job.salary_max) as number)
}

export default async function PublicJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const job = await fetchJob(id)
  if (!job) notFound()

  const level = prettify(job.level)
  const employment = prettify(job.employment_type)
  const locationType = prettify(job.location_type)
  const posted = formatDate(job.published_at || job.created_at)
  const salary = formatSalary(job)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <nav className="mb-6 text-sm" aria-label="Breadcrumb">
        <Link
          href="/jobs"
          className="text-muted-foreground hover:text-foreground"
        >
          ← All jobs
        </Link>
      </nav>

      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {job.title}
        </h1>
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
          {job.location && (
            <span className="text-sm text-muted-foreground">
              {job.location}
            </span>
          )}
          {locationType && (
            <span className="text-sm text-muted-foreground">
              · {locationType}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {salary && <span>{salary}</span>}
          {posted && <span>Posted {posted}</span>}
        </div>
        <div className="pt-2">
          <Link href={`/apply/${job.id}`}>
            <Button size="lg" className="rounded-full">
              Apply now
            </Button>
          </Link>
        </div>
      </header>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold text-foreground">About the role</h2>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {job.description}
        </div>
      </section>

      {job.required_skills && job.required_skills.length > 0 && (
        <SkillSection
          title="What we need"
          skills={job.required_skills}
          variant="default"
        />
      )}

      {job.nice_to_have_skills && job.nice_to_have_skills.length > 0 && (
        <SkillSection
          title="Nice to have"
          skills={job.nice_to_have_skills}
          variant="outline"
        />
      )}

      <Card className="mt-10">
        <CardContent className="flex flex-col items-start gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              Sound like you?
            </p>
            <p className="text-xs text-muted-foreground">
              GitHub link required. Resume optional but encouraged.
            </p>
          </div>
          <Link href={`/apply/${job.id}`}>
            <Button className="rounded-full">Apply now</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

// Skills with values longer than this threshold are almost certainly paragraph
// text stored in the wrong field — render as prose instead of a badge so they
// don't overflow the page as a single unwrappable token.
const SKILL_TAG_MAX_LENGTH = 60

function SkillSection({
  title,
  skills,
  variant,
}: {
  title: string
  skills: string[]
  variant: "default" | "outline"
}) {
  const tags = skills.filter((s) => s.trim().length <= SKILL_TAG_MAX_LENGTH)
  const prose = skills.filter((s) => s.trim().length > SKILL_TAG_MAX_LENGTH)

  return (
    <section className="mt-8 space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((skill) => (
            <Badge key={skill} variant={variant} className="font-normal">
              {skill}
            </Badge>
          ))}
        </div>
      )}
      {prose.map((text) => (
        <p key={text} className="text-sm leading-relaxed text-foreground/90">
          {text}
        </p>
      ))}
    </section>
  )
}
