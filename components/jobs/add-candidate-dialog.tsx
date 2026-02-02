"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Loader2, Plus, User, Mail, Phone, MapPin, Linkedin, Github, Globe, FileText, Sparkles, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useCreateCandidate, pollCandidateUntilScored, useInvalidateCandidates } from "@/hooks/use-candidates"

const formSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  location: z.string().optional(),
  linkedin_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  github_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  portfolio_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  cover_letter: z.string().optional(),
})

type FormValues = z.infer<typeof formSchema>

interface AddCandidateDialogProps {
  jobId: string
  onSuccess?: () => void
}

type ScoringState = 
  | { status: 'idle' }
  | { status: 'creating' }
  | { status: 'scoring'; progress: number; message: string }
  | { status: 'complete'; candidateName: string; score: number | null; hasAvatar: boolean }
  | { status: 'error'; message: string }

export function AddCandidateDialog({ jobId, onSuccess }: AddCandidateDialogProps) {
  const [open, setOpen] = useState(false)
  const [scoringState, setScoringState] = useState<ScoringState>({ status: 'idle' })
  const { toast } = useToast()
  const createCandidate = useCreateCandidate()
  const { invalidateLists } = useInvalidateCandidates()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      location: "",
      linkedin_url: "",
      github_url: "",
      portfolio_url: "",
      cover_letter: "",
    },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      // Clean up empty optional URL fields
      const cleanedValues = {
        ...values,
        linkedin_url: values.linkedin_url || undefined,
        github_url: values.github_url || undefined,
        portfolio_url: values.portfolio_url || undefined,
        phone: values.phone || undefined,
        location: values.location || undefined,
        cover_letter: values.cover_letter || undefined,
      }

      setScoringState({ status: 'creating' })

      const candidate = await createCandidate.mutateAsync({
        ...cleanedValues,
        job_id: jobId,
        source: "manual",
      })
      
      // Check if we have profile data that could be scored
      const hasProfileData = cleanedValues.github_url || cleanedValues.linkedin_url || cleanedValues.cover_letter
      
      if (hasProfileData) {
        // Poll for AI scoring completion
        setScoringState({ 
          status: 'scoring', 
          progress: 10, 
          message: 'Fetching profile data...' 
        })

        const scoredCandidate = await pollCandidateUntilScored(candidate.id, {
          maxAttempts: 15,
          intervalMs: 2000,
          onProgress: (attempt) => {
            const progress = Math.min(10 + (attempt * 6), 90)
            const messages = [
              'Fetching profile data...',
              'Analyzing GitHub repositories...',
              'Extracting skills and experience...',
              'Matching against job requirements...',
              'Calculating AI score...',
              'Finalizing analysis...',
            ]
            const messageIndex = Math.min(Math.floor(attempt / 2), messages.length - 1)
            setScoringState({ 
              status: 'scoring', 
              progress, 
              message: messages[messageIndex] 
            })
          },
        })

        // Invalidate queries to refresh the UI
        invalidateLists()

        if (scoredCandidate) {
          setScoringState({ 
            status: 'complete', 
            candidateName: scoredCandidate.full_name || candidate.full_name,
            score: scoredCandidate.ai_score ?? null,
            hasAvatar: !!scoredCandidate.avatar_url,
          })
          
          // Show success state briefly before closing
          await new Promise(resolve => setTimeout(resolve, 1500))
        } else {
          // Scoring didn't complete in time, but candidate was created
          toast({
            title: "Candidate Added",
            description: `${candidate.full_name} has been added. AI scoring is still processing and will update shortly.`,
          })
        }
      } else {
        // No profile data - just show success
        toast({
          title: "Candidate Added", 
          description: `${candidate.full_name} has been added. Add a GitHub profile or cover letter for AI matching.`,
        })
      }

      // Close dialog and reset form
      setOpen(false)
      form.reset()
      setScoringState({ status: 'idle' })
      
      // Trigger callback
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Error adding candidate:", error)
      setScoringState({ 
        status: 'error', 
        message: error instanceof Error ? error.message : "Failed to add candidate" 
      })
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add candidate",
        variant: "destructive",
      })
    }
  }

  const isProcessing = scoringState.status === 'creating' || scoringState.status === 'scoring'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Prevent closing while processing
      if (!isProcessing) {
        setOpen(isOpen)
        if (!isOpen) {
          setScoringState({ status: 'idle' })
        }
      }
    }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Candidate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Scoring Progress Overlay */}
        {(scoringState.status === 'scoring' || scoringState.status === 'complete') && (
          <div className="absolute inset-0 bg-background/95 z-50 flex items-center justify-center rounded-lg">
            <div className="text-center space-y-4 p-8 max-w-sm">
              {scoringState.status === 'scoring' ? (
                <>
                  <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">AI Screening in Progress</h3>
                    <p className="text-sm text-muted-foreground">{scoringState.message}</p>
                  </div>
                  <Progress value={scoringState.progress} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    This may take up to 30 seconds...
                  </p>
                </>
              ) : scoringState.status === 'complete' ? (
                <>
                  <div className="mx-auto h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-success" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Candidate Added</h3>
                    <p className="text-sm text-muted-foreground">
                      {scoringState.candidateName} has been screened
                    </p>
                    {scoringState.score !== null && scoringState.score > 0 && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-medium">
                        <Sparkles className="h-4 w-4" />
                        {scoringState.score}% Match
                      </div>
                    )}
                    {scoringState.hasAvatar && (
                      <p className="text-xs text-muted-foreground">
                        Profile photo imported from GitHub
                      </p>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        <DialogHeader>
          <DialogTitle>Add New Candidate</DialogTitle>
          <DialogDescription>
            Manually add a candidate to this job position. They will be added to the &quot;Applied&quot; stage.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Full Name *
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
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
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email *
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="+1 (555) 123-4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Location
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="New York, NY" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Profile Links */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Profile Links</h3>
              <FormField
                control={form.control}
                name="linkedin_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Linkedin className="h-4 w-4" />
                      LinkedIn URL
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://linkedin.com/in/johndoe" {...field} />
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
                    <FormLabel className="flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      GitHub URL
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://github.com/johndoe" {...field} />
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
                    <FormLabel className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Portfolio URL
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://johndoe.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Cover Letter / Notes */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Additional Information</h3>
              <FormField
                control={form.control}
                name="cover_letter"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Cover Letter / Notes
                    </FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any notes, cover letter content, or additional context about this candidate..." 
                        rows={4}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isProcessing}>
                {scoringState.status === 'creating' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {scoringState.status === 'creating' ? 'Creating...' : 'Add Candidate'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
