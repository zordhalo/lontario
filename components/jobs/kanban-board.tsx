"use client"

import React, { useState } from "react"

import { CandidateCard } from "@/components/jobs/candidate-card"
import type { Candidate } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

interface KanbanBoardProps {
  candidates: Candidate[]
  onCandidateSelect: (candidate: Candidate) => void
  onStatusChange: (candidateId: string, status: Candidate["status"]) => void
  selectedCandidateId?: string
  onApprove?: (candidate: Candidate) => void
  onReject?: (candidate: Candidate) => void
  onSchedule?: (candidate: Candidate) => void
}

// Empty state messages with humor
const emptyStateMessages: Record<string, string> = {
  applied: "No new applicants. Time to polish that job description?",
  screening: "No one to screen. Either you're picky or they are.",
  ai_interview: "AI is ready and waiting. Send some candidates!",
  phone_screen: "Phones are silent. That's... unusual for recruiting.",
  technical: "No technical interviews. The whiteboard is lonely.",
  onsite: "Office is quiet. Too quiet.",
  offer: "No offers yet. We're playing hard to get.",
  hired: "No hires yet. The team photo remains unchanged.",
  rejected: "No rejections. Either you're too nice or too optimistic.",
}

const columns: { status: Candidate["status"]; label: string; variant?: "destructive" }[] = [
  { status: "applied", label: "Applied" },
  { status: "screening", label: "Screening" },
  { status: "ai_interview", label: "AI Interview" },
  { status: "phone_screen", label: "Phone Screen" },
  { status: "technical", label: "Technical" },
  { status: "onsite", label: "Onsite" },
  { status: "offer", label: "Offer" },
  { status: "hired", label: "Hired" },
  { status: "rejected", label: "Rejected", variant: "destructive" },
]

export function KanbanBoard({
  candidates,
  onCandidateSelect,
  onStatusChange,
  selectedCandidateId,
  onApprove,
  onReject,
  onSchedule,
}: KanbanBoardProps) {
  const [draggingOver, setDraggingOver] = useState<string | null>(null)
  
  const getCandidatesByStatus = (status: Candidate["status"]) => {
    return candidates
      .filter((c) => c.status === status)
      .sort((a, b) => b.aiScore - a.aiScore)
  }

  const handleDragStart = (e: React.DragEvent, candidate: Candidate) => {
    e.dataTransfer.setData("candidateId", candidate.id)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDraggingOver(status)
  }

  const handleDragLeave = () => {
    setDraggingOver(null)
  }

  const handleDrop = (e: React.DragEvent, status: Candidate["status"]) => {
    e.preventDefault()
    setDraggingOver(null)
    const candidateId = e.dataTransfer.getData("candidateId")
    if (candidateId) {
      onStatusChange(candidateId, status)
    }
  }

  return (
    <div className="h-full overflow-x-auto pb-4 px-4 lg:px-6">
      <div className="flex gap-4 h-full min-w-max lg:min-w-0">
        {columns.map((column) => {
          const columnCandidates = getCandidatesByStatus(column.status)
          const isDragTarget = draggingOver === column.status
          
          return (
            <div
              key={column.status}
              className="w-72 shrink-0 lg:shrink flex flex-col h-full"
              onDragOver={(e) => handleDragOver(e, column.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.status)}
            >
              {/* Column Header - Improved styling */}
              <div className={cn(
                "flex items-center justify-between mb-3 px-3 py-2 rounded-t-lg border-b",
                column.variant === "destructive"
                  ? "bg-destructive/5 border-destructive/20"
                  : "bg-muted/50 border-border"
              )}>
                <h3 className={cn(
                  "font-medium text-sm",
                  column.variant === "destructive" ? "text-destructive" : "text-foreground"
                )}>
                  {column.label}
                </h3>
                <span className={cn(
                  "text-xs font-medium rounded-full px-2 py-0.5",
                  column.variant === "destructive" 
                    ? "text-destructive bg-destructive/10" 
                    : "text-muted-foreground bg-background"
                )}>
                  {columnCandidates.length}
                </span>
              </div>

              {/* Column Content - Enhanced drop zone */}
              <div
                className={cn(
                  "flex-1 rounded-lg p-2 space-y-2 overflow-y-auto transition-all duration-200",
                  "border-2 border-dashed",
                  isDragTarget
                    ? column.variant === "destructive"
                      ? "border-destructive/50 bg-destructive/10"
                      : "border-primary/50 bg-primary/5"
                    : column.variant === "destructive" 
                      ? "border-transparent bg-destructive/5 hover:border-destructive/20" 
                      : "border-transparent bg-muted/30 hover:border-muted-foreground/20"
                )}
              >
                {columnCandidates.length === 0 ? (
                  <div className={cn(
                    "flex flex-col items-center justify-center h-24 text-center px-2",
                    isDragTarget ? "opacity-70" : ""
                  )}>
                    <p className="text-sm text-muted-foreground">
                      {isDragTarget 
                        ? "Drop here!" 
                        : emptyStateMessages[column.status] || "Drop candidates here (gently, they're people)"
                      }
                    </p>
                  </div>
                ) : (
                  columnCandidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      onClick={() => onCandidateSelect(candidate)}
                      onDragStart={(e) => handleDragStart(e, candidate)}
                      isSelected={selectedCandidateId === candidate.id}
                      onApprove={onApprove}
                      onReject={onReject}
                      onSchedule={onSchedule}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
