"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { JobDescription, JobLevel } from "@/types"

interface JobDescriptionInputProps {
  onSubmit: (job: JobDescription) => void
  initialData?: Partial<JobDescription>
}

const JOB_LEVELS: { value: JobLevel; label: string }[] = [
  { value: "junior", label: "Junior (0-2 years)" },
  { value: "mid", label: "Mid-Level (2-5 years)" },
  { value: "senior", label: "Senior (5-8 years)" },
  { value: "staff", label: "Staff (8-12 years)" },
  { value: "principal", label: "Principal (12+ years)" },
]

/**
 * Form component for entering job description details
 * Validates input and collects: title, level, description, required skills, nice-to-have skills
 */
export function JobDescriptionInput({
  onSubmit,
  initialData,
}: JobDescriptionInputProps) {
  const [title, setTitle] = useState(initialData?.title || "")
  const [level, setLevel] = useState<JobLevel>(initialData?.level || "mid")
  const [description, setDescription] = useState(initialData?.description || "")
  const [requiredSkills, setRequiredSkills] = useState<string[]>(
    initialData?.requiredSkills || []
  )
  const [niceToHave, setNiceToHave] = useState<string[]>(
    initialData?.niceToHave || []
  )
  const [skillInput, setSkillInput] = useState("")
  const [niceToHaveInput, setNiceToHaveInput] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleAddSkill = (
    input: string,
    skills: string[],
    setSkills: (skills: string[]) => void,
    setInput: (input: string) => void
  ) => {
    const trimmed = input.trim()
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed])
      setInput("")
    }
  }

  const handleRemoveSkill = (
    skill: string,
    skills: string[],
    setSkills: (skills: string[]) => void
  ) => {
    setSkills(skills.filter((s) => s !== skill))
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    input: string,
    skills: string[],
    setSkills: (skills: string[]) => void,
    setInput: (input: string) => void
  ) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddSkill(input, skills, setSkills, setInput)
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!title.trim()) {
      newErrors.title = "Job title is required"
    }

    if (description.length < 100) {
      newErrors.description = `Description must be at least 100 characters (${description.length}/100)`
    }

    if (requiredSkills.length === 0) {
      newErrors.requiredSkills = "At least one required skill is needed"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onSubmit({
        title: title.trim(),
        level,
        description: description.trim(),
        requiredSkills,
        niceToHave,
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Description</CardTitle>
        <CardDescription>
          Enter the job details to generate personalized interview questions
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* Job Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Senior Frontend Engineer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title}</p>
            )}
          </div>

          {/* Experience Level */}
          <div className="space-y-2">
            <Label htmlFor="level">Experience Level *</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as JobLevel)}>
              <SelectTrigger id="level">
                <SelectValue placeholder="Select experience level" />
              </SelectTrigger>
              <SelectContent>
                {JOB_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Job Description */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description * ({description.length}/100 min)
            </Label>
            <Textarea
              id="description"
              placeholder="Describe the role, responsibilities, team, and ideal candidate..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={cn(
                "min-h-[150px] resize-y",
                errors.description ? "border-destructive" : ""
              )}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description}</p>
            )}
          </div>

          {/* Required Skills */}
          <div className="space-y-2">
            <Label htmlFor="requiredSkills">Required Skills *</Label>
            <div className="flex gap-2">
              <Input
                id="requiredSkills"
                placeholder="Type a skill and press Enter"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) =>
                  handleKeyDown(
                    e,
                    skillInput,
                    requiredSkills,
                    setRequiredSkills,
                    setSkillInput
                  )
                }
                className={errors.requiredSkills ? "border-destructive" : ""}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  handleAddSkill(
                    skillInput,
                    requiredSkills,
                    setRequiredSkills,
                    setSkillInput
                  )
                }
              >
                Add
              </Button>
            </div>
            {requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {requiredSkills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="cursor-pointer hover:bg-destructive/20"
                    onClick={() =>
                      handleRemoveSkill(skill, requiredSkills, setRequiredSkills)
                    }
                  >
                    {skill}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
            {errors.requiredSkills && (
              <p className="text-sm text-destructive">{errors.requiredSkills}</p>
            )}
          </div>

          {/* Nice-to-Have Skills */}
          <div className="space-y-2">
            <Label htmlFor="niceToHave">Nice-to-Have Skills (Optional)</Label>
            <div className="flex gap-2">
              <Input
                id="niceToHave"
                placeholder="Type a skill and press Enter"
                value={niceToHaveInput}
                onChange={(e) => setNiceToHaveInput(e.target.value)}
                onKeyDown={(e) =>
                  handleKeyDown(
                    e,
                    niceToHaveInput,
                    niceToHave,
                    setNiceToHave,
                    setNiceToHaveInput
                  )
                }
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  handleAddSkill(
                    niceToHaveInput,
                    niceToHave,
                    setNiceToHave,
                    setNiceToHaveInput
                  )
                }
              >
                Add
              </Button>
            </div>
            {niceToHave.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {niceToHave.map((skill) => (
                  <Badge
                    key={skill}
                    variant="outline"
                    className="cursor-pointer hover:bg-destructive/20"
                    onClick={() =>
                      handleRemoveSkill(skill, niceToHave, setNiceToHave)
                    }
                  >
                    {skill}
                    <X className="ml-1 h-3 w-3" />
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full">
            Continue to Candidate Profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
