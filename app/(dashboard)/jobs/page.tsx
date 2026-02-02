"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Grid3X3, List, Plus, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { JobFilters } from "@/components/jobs/job-filters"
import { JobCard } from "@/components/jobs/job-card"
import { useJobs } from "@/hooks/use-jobs"
import { normalizeJob, type Job } from "@/lib/mock-data"
import { Skeleton } from "@/components/ui/skeleton"

export default function JobsPage() {
  const [view, setView] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState({
    status: ["active"],
    department: [] as string[],
    showArchived: false,
  })

  // Fetch jobs from API with archive filter
  const { data, isLoading, error } = useJobs({ 
    include_archived: filters.showArchived 
  })

  // Normalize and filter jobs
  const filteredJobs = useMemo(() => {
    if (!data?.jobs) return []
    
    return data.jobs
      .map(normalizeJob)
      .filter((job) => {
        const matchesSearch = job.title
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
        const matchesStatus =
          filters.status.length === 0 || filters.status.includes(job.status)
        const matchesDepartment =
          filters.department.length === 0 ||
          (job.department && filters.department.includes(job.department))
        // When showArchived is false, API already filters them out
        // When showArchived is true, show all jobs (archived and non-archived)
        return matchesSearch && matchesStatus && matchesDepartment
      })
  }, [data?.jobs, searchQuery, filters])

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
          <p className="text-muted-foreground">
            Manage your job postings and view candidates
          </p>
        </div>
        <Link href="/jobs/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Job
          </Button>
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filters Sidebar */}
        <aside className="w-full lg:w-64 shrink-0">
          <JobFilters filters={filters} onFiltersChange={setFilters} />
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {/* Search and View Toggle */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1 border border-border rounded-lg p-1">
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("grid")}
                aria-label="Grid view"
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView("list")}
                aria-label="List view"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Jobs Grid/List */}
          {isLoading ? (
            <div
              className={
                view === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                  : "flex flex-col gap-4"
              }
            >
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-48 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">
                Failed to load jobs
              </h3>
              <p className="text-muted-foreground mb-4">
                {error.message || "Please try again later"}
              </p>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-1">
                No jobs found
              </h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your filters or search query
              </p>
              <Link href="/jobs/new">
                <Button>Create your first job</Button>
              </Link>
            </div>
          ) : (
            <div
              className={
                view === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
                  : "flex flex-col gap-4"
              }
            >
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} variant={view} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
