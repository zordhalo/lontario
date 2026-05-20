"use client"

import { useCallback, useId, useRef, useState } from "react"
import { FileText, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

export const MAX_RESUME_BYTES = 10 * 1024 * 1024 // 10 MB
const ACCEPTED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])
const ACCEPTED_EXT = [".pdf", ".doc", ".docx"]

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase()
  return ACCEPTED_EXT.some((ext) => lower.endsWith(ext))
}

interface ResumeUploaderProps {
  value: File | null
  onChange: (file: File | null) => void
  disabled?: boolean
}

export function ResumeUploader({
  value,
  onChange,
  disabled,
}: ResumeUploaderProps) {
  const inputId = useId()
  const errorId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const validateAndSet = useCallback(
    (file: File | null) => {
      if (!file) {
        setError(null)
        onChange(null)
        return
      }
      // MIME can be empty on some browsers; fall back to extension check.
      const mimeOk = ACCEPTED_MIME.has(file.type) || file.type === ""
      const extOk = hasAcceptedExtension(file.name)
      if (!mimeOk || !extOk) {
        setError("PDF, DOC, or DOCX only.")
        onChange(null)
        return
      }
      if (file.size > MAX_RESUME_BYTES) {
        setError(`File is too big — max 10 MB (got ${formatBytes(file.size)}).`)
        onChange(null)
        return
      }
      setError(null)
      onChange(file)
    },
    [onChange]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null
    validateAndSet(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files?.[0] ?? null
    validateAndSet(file)
  }

  const handleClear = () => {
    setError(null)
    onChange(null)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        Resume{" "}
        <span className="font-normal text-muted-foreground">
          (optional, but it helps)
        </span>
      </Label>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card px-4 py-6 text-center transition-colors",
          "hover:border-accent/60 hover:bg-card/80",
          "focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          isDragging && "border-accent bg-accent/5",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        {value ? (
          <div className="flex w-full items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-left">
              <FileText
                className="h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {value.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(value.size)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.preventDefault()
                handleClear()
              }}
              disabled={disabled}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Upload
              className="h-5 w-5 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-foreground">
              <span className="font-medium text-accent">Click to upload</span>{" "}
              or drag and drop
            </p>
            <p className="text-xs text-muted-foreground">
              PDF, DOC, or DOCX · up to 10 MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={handleInputChange}
          disabled={disabled}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
        />
      </label>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
