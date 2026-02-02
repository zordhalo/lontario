"use client"

import { useState } from "react"
import { Github, Linkedin, User, X, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { useScrapeProfile } from "@/hooks/use-ai"
import type { CandidateProfile } from "@/types"

interface ProfileInputProps {
  onSubmit: (profile: CandidateProfile) => void
  onBack: () => void
  initialData?: Partial<CandidateProfile>
}

/**
 * Component for entering or fetching candidate profile information
 * Supports GitHub/LinkedIn URL fetching and manual entry
 */
export function ProfileInput({
  onSubmit,
  onBack,
  initialData,
}: ProfileInputProps) {
  const [mode, setMode] = useState<"url" | "manual">("url")
  const [url, setUrl] = useState("")
  const [fetchedProfile, setFetchedProfile] = useState<CandidateProfile | null>(
    initialData?.source === "github" || initialData?.source === "linkedin"
      ? (initialData as CandidateProfile)
      : null
  )

  // Manual entry state
  const [name, setName] = useState(initialData?.name || "")
  const [bio, setBio] = useState(initialData?.bio || "")
  const [skills, setSkills] = useState<string[]>(initialData?.skills || [])
  const [experience, setExperience] = useState<string[]>(
    initialData?.experience || []
  )
  const [skillInput, setSkillInput] = useState("")
  const [experienceInput, setExperienceInput] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const scrapeProfile = useScrapeProfile()

  const handleFetchProfile = async () => {
    if (!url.trim()) {
      setErrors({ url: "Please enter a URL or username" })
      return
    }

    setErrors({})
    scrapeProfile.mutate(
      { url: url.trim() },
      {
        onSuccess: (data) => {
          setFetchedProfile(data.profile)
        },
        onError: (error) => {
          setErrors({ url: error.message })
        },
      }
    )
  }

  const handleClearFetched = () => {
    setFetchedProfile(null)
    setUrl("")
  }

  const handleAddSkill = () => {
    const trimmed = skillInput.trim()
    if (trimmed && !skills.includes(trimmed)) {
      setSkills([...skills, trimmed])
      setSkillInput("")
    }
  }

  const handleRemoveSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill))
  }

  const handleAddExperience = () => {
    const trimmed = experienceInput.trim()
    if (trimmed && !experience.includes(trimmed)) {
      setExperience([...experience, trimmed])
      setExperienceInput("")
    }
  }

  const handleRemoveExperience = (exp: string) => {
    setExperience(experience.filter((e) => e !== exp))
  }

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    handler: () => void
  ) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handler()
    }
  }

  const validateManual = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = "Name is required"
    }

    if (skills.length === 0) {
      newErrors.skills = "At least one skill is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (mode === "url" && fetchedProfile) {
      onSubmit(fetchedProfile)
    } else if (mode === "manual") {
      if (validateManual()) {
        onSubmit({
          source: "manual",
          name: name.trim(),
          bio: bio.trim() || undefined,
          skills,
          experience,
        })
      }
    }
  }

  const isSubmitDisabled =
    (mode === "url" && !fetchedProfile) ||
    (mode === "manual" && (!name.trim() || skills.length === 0))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Profile</CardTitle>
        <CardDescription>
          Fetch profile from GitHub/LinkedIn or enter details manually
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "url" | "manual")}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="url" className="gap-2">
              <Github className="h-4 w-4" />
              Fetch Profile
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <User className="h-4 w-4" />
              Manual Entry
            </TabsTrigger>
          </TabsList>

          {/* URL Fetch Mode */}
          <TabsContent value="url" className="space-y-6">
            {!fetchedProfile ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="profileUrl">GitHub or LinkedIn URL</Label>
                  <div className="flex gap-2">
                    <Input
                      id="profileUrl"
                      placeholder="github.com/username or linkedin.com/in/username"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleFetchProfile()
                      }
                      className={errors.url ? "border-destructive" : ""}
                    />
                    <Button
                      type="button"
                      onClick={handleFetchProfile}
                      disabled={scrapeProfile.isPending}
                    >
                      {scrapeProfile.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Fetch"
                      )}
                    </Button>
                  </div>
                  {errors.url && (
                    <p className="text-sm text-destructive">{errors.url}</p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    <span>GitHub: Free, unlimited</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4" />
                    <span>LinkedIn: Requires API key</span>
                  </div>
                </div>
              </>
            ) : (
              <ProfilePreview
                profile={fetchedProfile}
                onClear={handleClearFetched}
                onRefresh={() => handleFetchProfile()}
                isRefreshing={scrapeProfile.isPending}
              />
            )}
          </TabsContent>

          {/* Manual Entry Mode */}
          <TabsContent value="manual" className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio / Summary (Optional)</Label>
              <Textarea
                id="bio"
                placeholder="Brief professional summary..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="min-h-[80px] resize-y"
              />
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <Label htmlFor="skills">Skills *</Label>
              <div className="flex gap-2">
                <Input
                  id="skills"
                  placeholder="Type a skill and press Enter"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleAddSkill)}
                  className={errors.skills ? "border-destructive" : ""}
                />
                <Button type="button" variant="secondary" onClick={handleAddSkill}>
                  Add
                </Button>
              </div>
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="cursor-pointer hover:bg-destructive/20"
                      onClick={() => handleRemoveSkill(skill)}
                    >
                      {skill}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              )}
              {errors.skills && (
                <p className="text-sm text-destructive">{errors.skills}</p>
              )}
            </div>

            {/* Experience */}
            <div className="space-y-2">
              <Label htmlFor="experience">Experience (Optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="experience"
                  placeholder="e.g., Senior Engineer at Google (2020-2024)"
                  value={experienceInput}
                  onChange={(e) => setExperienceInput(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleAddExperience)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddExperience}
                >
                  Add
                </Button>
              </div>
              {experience.length > 0 && (
                <div className="space-y-2 pt-2">
                  {experience.map((exp) => (
                    <div
                      key={exp}
                      className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2 text-sm"
                    >
                      <span>{exp}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveExperience(exp)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          type="button"
          className="flex-1"
          onClick={handleSubmit}
          disabled={isSubmitDisabled}
        >
          Generate Questions
        </Button>
      </CardFooter>
    </Card>
  )
}

/**
 * Preview component for displaying fetched profile data
 */
function ProfilePreview({
  profile,
  onClear,
  onRefresh,
  isRefreshing,
}: {
  profile: CandidateProfile
  onClear: () => void
  onRefresh: () => void
  isRefreshing: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {profile.source === "github" ? (
            <Github className="h-8 w-8 text-muted-foreground" />
          ) : (
            <Linkedin className="h-8 w-8 text-[#0A66C2]" />
          )}
          <div>
            <h3 className="font-semibold">{profile.name}</h3>
            {profile.url && (
              <a
                href={profile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:underline"
              >
                {profile.url}
              </a>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClear}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {profile.bio && (
        <p className="text-sm text-muted-foreground">{profile.bio}</p>
      )}

      {profile.skills.length > 0 && (
        <div>
          <Label className="text-xs uppercase text-muted-foreground">
            Skills
          </Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {profile.skills.slice(0, 15).map((skill) => (
              <Badge key={skill} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
            {profile.skills.length > 15 && (
              <Badge variant="outline" className="text-xs">
                +{profile.skills.length - 15} more
              </Badge>
            )}
          </div>
        </div>
      )}

      {profile.projects && profile.projects.length > 0 && (
        <div>
          <Label className="text-xs uppercase text-muted-foreground">
            Top Projects
          </Label>
          <div className="space-y-1.5 mt-1.5">
            {profile.projects.slice(0, 3).map((project) => (
              <div
                key={project.name}
                className="flex items-center justify-between rounded border bg-muted/30 px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium">{project.name}</span>
                  {project.language && (
                    <span className="ml-2 text-muted-foreground">
                      {project.language}
                    </span>
                  )}
                </div>
                <span className="text-muted-foreground">
                  {project.stars} stars
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
