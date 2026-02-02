"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Loader2, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useCreateJob } from "@/hooks/use-jobs"
import type { CreateJobRequest } from "@/types"

const steps = [
  { id: 1, name: "Basic Info" },
  { id: 2, name: "Job Description" },
  { id: 3, name: "Review & Publish" },
]

const departments = [
  "Engineering",
  "Product",
  "Design",
  "Marketing",
  "Sales",
  "Operations",
  "HR",
]

const levels = ["Entry-level", "Mid-level", "Senior", "Lead", "Manager", "Director"]

const locations = [
  "Remote",
  "Hybrid - NYC",
  "Hybrid - SF",
  "On-site - NYC",
  "On-site - SF",
  "On-site - Austin",
]

const jobTypes = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
]

// Map UI level values to API level values
const levelMap: Record<string, "junior" | "mid" | "senior" | "staff" | "principal"> = {
  "Entry-level": "junior",
  "Mid-level": "mid",
  "Senior": "senior",
  "Lead": "staff",
  "Manager": "staff",
  "Director": "principal",
}

// Map UI location to location_type
function getLocationType(location: string): "remote" | "onsite" | "hybrid" | undefined {
  if (location.toLowerCase().includes("remote")) return "remote"
  if (location.toLowerCase().includes("hybrid")) return "hybrid"
  if (location.toLowerCase().includes("on-site")) return "onsite"
  return undefined
}

export default function NewJobPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const createJob = useCreateJob()

  const [formData, setFormData] = useState({
    title: "",
    department: "",
    level: "",
    location: "",
    type: "full-time" as "full-time" | "part-time" | "contract" | "internship",
    requirements: [""],
    description: "",
  })

  const handleRequirementChange = (index: number, value: string) => {
    const newRequirements = [...formData.requirements]
    newRequirements[index] = value
    setFormData({ ...formData, requirements: newRequirements })
  }

  const addRequirement = () => {
    setFormData({
      ...formData,
      requirements: [...formData.requirements, ""],
    })
  }

  const removeRequirement = (index: number) => {
    const newRequirements = formData.requirements.filter((_, i) => i !== index)
    setFormData({
      ...formData,
      requirements: newRequirements.length > 0 ? newRequirements : [""],
    })
  }

  const generateDescription = async () => {
    if (!formData.title || formData.requirements.filter((r) => r).length === 0) {
      toast.error("Please fill in job title and at least one requirement")
      return
    }

    setIsGenerating(true)
    // Simulate AI generation
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const generatedDescription = `We're looking for a ${formData.level || "talented"} ${formData.title} to join our ${formData.department || "growing"} team.

About the Role:
As a ${formData.title}, you'll play a key role in driving our technical initiatives forward. You'll work with a collaborative team of engineers, designers, and product managers to build innovative solutions that impact millions of users.

What You'll Do:
- Design, develop, and maintain high-quality software solutions
- Collaborate with cross-functional teams to define and implement new features
- Participate in code reviews and contribute to engineering best practices
- Mentor junior team members and share knowledge across the team
- Help shape our technical roadmap and architecture decisions

What We're Looking For:
${formData.requirements
  .filter((r) => r)
  .map((r) => `- ${r}`)
  .join("\n")}

Nice to Have:
- Experience with agile development methodologies
- Open source contributions
- Strong communication skills

What We Offer:
- Competitive salary and equity
- Comprehensive health benefits
- Flexible work arrangements
- Professional development budget
- Great team culture and learning opportunities

We're building something special, and we'd love for you to be a part of it. Apply now!`

    setFormData({ ...formData, description: generatedDescription })
    setIsGenerating(false)
    setCurrentStep(2)
  }

  const transformFormData = (): CreateJobRequest => {
    const filteredRequirements = formData.requirements.filter((r) => r.trim())
    
    return {
      title: formData.title,
      level: levelMap[formData.level],
      department: formData.department || undefined,
      location: formData.location || undefined,
      location_type: getLocationType(formData.location),
      employment_type: formData.type,
      description: formData.description,
      required_skills: filteredRequirements.length > 0 ? filteredRequirements : ["General skills"],
      nice_to_have_skills: [],
    }
  }

  const handlePublish = async () => {
    setIsSaving(true)
    try {
      const jobData = transformFormData()
      await createJob.mutateAsync({ ...jobData, status: "active" })
      toast.success("Job published successfully!")
      router.push("/jobs")
    } catch (error) {
      console.error("Failed to create job:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create job")
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveDraft = async () => {
    setIsSaving(true)
    try {
      const jobData = transformFormData()
      await createJob.mutateAsync(jobData)
      toast.success("Draft saved successfully!")
      router.push("/jobs")
    } catch (error) {
      console.error("Failed to save draft:", error)
      toast.error(error instanceof Error ? error.message : "Failed to save draft")
    } finally {
      setIsSaving(false)
    }
  }

  const canProceedToStep2 =
    formData.title &&
    formData.department &&
    formData.level &&
    formData.location &&
    formData.requirements.some((r) => r.trim())

  const canPublish = formData.description.trim().length > 50

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-16 z-40">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          {/* Breadcrumb */}
          <Breadcrumb className="mb-3">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/jobs">Jobs</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Create New Job</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/jobs">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sr-only">Back to Jobs</span>
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-foreground">
                Create New Job
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Draft
              </Button>
              <Button onClick={() => setCurrentStep(3)} disabled={!canPublish || isSaving}>
                Review & Publish
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b border-border bg-card">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center gap-8">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => {
                  if (step.id < currentStep) setCurrentStep(step.id)
                  if (step.id === 2 && canProceedToStep2) setCurrentStep(step.id)
                  if (step.id === 3 && canPublish) setCurrentStep(step.id)
                }}
                className={cn(
                  "flex items-center gap-2 text-sm font-medium transition-colors",
                  currentStep === step.id
                    ? "text-primary"
                    : currentStep > step.id
                      ? "text-success"
                      : "text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-sm",
                    currentStep === step.id
                      ? "bg-primary text-primary-foreground"
                      : currentStep > step.id
                        ? "bg-success text-success-foreground"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {currentStep > step.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.id
                  )}
                </span>
                <span className="hidden sm:inline">{step.name}</span>
                {index < steps.length - 1 && (
                  <span className="mx-4 h-px w-12 bg-border hidden sm:block" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="container max-w-4xl mx-auto px-4 py-8">
        {/* Step 1: Basic Info */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title *</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Senior Backend Engineer"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="department">Department *</Label>
                    <Select
                      value={formData.department}
                      onValueChange={(value) =>
                        setFormData({ ...formData, department: value })
                      }
                    >
                      <SelectTrigger id="department">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="level">Level *</Label>
                    <Select
                      value={formData.level}
                      onValueChange={(value) =>
                        setFormData({ ...formData, level: value })
                      }
                    >
                      <SelectTrigger id="level">
                        <SelectValue placeholder="Select level" />
                      </SelectTrigger>
                      <SelectContent>
                        {levels.map((level) => (
                          <SelectItem key={level} value={level}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location *</Label>
                    <Select
                      value={formData.location}
                      onValueChange={(value) =>
                        setFormData({ ...formData, location: value })
                      }
                    >
                      <SelectTrigger id="location">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="type">Employment Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, type: value })
                      }
                    >
                      <SelectTrigger id="type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {jobTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Key Requirements</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Add the main requirements for this role. AI will use these to
                  generate a job description.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {formData.requirements.map((req, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      placeholder="e.g., 5+ years of Python experience"
                      value={req}
                      onChange={(e) =>
                        handleRequirementChange(index, e.target.value)
                      }
                    />
                    {formData.requirements.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRequirement(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button variant="outline" onClick={addRequirement}>
                  + Add Requirement
                </Button>
              </CardContent>
            </Card>

            {/* AI Generate Button */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="py-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        AI-Powered Job Description
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Generate a professional job description based on your
                        inputs
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={generateDescription}
                    disabled={!canProceedToStep2 || isGenerating}
                    className="shrink-0"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Description
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Job Description */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Job Description</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Edit the AI-generated description or write your own
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-primary/10 text-primary border-primary/30"
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    AI Generated
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="min-h-[400px] font-mono text-sm"
                  placeholder="Write your job description here..."
                />
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={generateDescription}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Regenerate
                </Button>
                <Button onClick={() => setCurrentStep(3)} disabled={!canPublish}>
                  Review & Publish
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review & Publish */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Review Your Job Posting</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Job Overview */}
                <div className="p-4 rounded-lg bg-muted/50 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">
                        {formData.title}
                      </h3>
                      <p className="text-muted-foreground">
                        {formData.department} &bull; {formData.location} &bull;{" "}
                        {formData.type}
                      </p>
                    </div>
                    <Badge variant="outline">{formData.level}</Badge>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-2">
                      Requirements
                    </h4>
                    <ul className="space-y-1">
                      {formData.requirements
                        .filter((r) => r.trim())
                        .map((req, index) => (
                          <li
                            key={index}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                            {req}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>

                {/* Description Preview */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">
                    Job Description
                  </h4>
                  <div className="p-4 rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {formData.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(2)} disabled={isSaving}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Edit
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={handleSaveDraft} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save as Draft
                </Button>
                <Button onClick={handlePublish} disabled={isSaving}>
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Publish Job
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
