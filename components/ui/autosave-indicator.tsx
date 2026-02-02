import { Check, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

type AutosaveStatus = "idle" | "saving" | "saved" | "error"

interface AutosaveIndicatorProps {
  status: AutosaveStatus
  className?: string
}

export function AutosaveIndicator({ status, className }: AutosaveIndicatorProps) {
  if (status === "idle") return null

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground transition-opacity",
        className
      )}
    >
      {status === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Saving...</span>
        </>
      )}
      {status === "saved" && (
        <>
          <Check className="h-3 w-3 text-success" />
          <span className="text-success">Saved</span>
        </>
      )}
      {status === "error" && (
        <>
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span className="text-destructive">Failed to save</span>
        </>
      )}
    </div>
  )
}
