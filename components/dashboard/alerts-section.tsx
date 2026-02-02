"use client"

import Link from "next/link"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle,
  FileText,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboardAlerts, type DashboardAlert } from "@/hooks/use-dashboard"

interface AlertsSectionProps {
  className?: string
}

const getAlertStyle = (type: DashboardAlert["type"]) => {
  switch (type) {
    case "high_score":
      return {
        icon: Sparkles,
        iconColor: "text-success",
        iconBg: "bg-success/10",
        action: "Review now",
      }
    case "pending_interview":
      return {
        icon: Calendar,
        iconColor: "text-warning",
        iconBg: "bg-warning/10",
        action: "Schedule",
      }
    case "review_ready":
      return {
        icon: FileText,
        iconColor: "text-info",
        iconBg: "bg-info/10",
        action: "View summaries",
      }
    default:
      return {
        icon: AlertCircle,
        iconColor: "text-muted-foreground",
        iconBg: "bg-muted",
        action: "View",
      }
  }
}

export function AlertsSection({ className }: AlertsSectionProps) {
  const { data, isLoading, error } = useDashboardAlerts()

  if (isLoading) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Needs Your Attention</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-4 w-64" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Needs Your Attention</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load alerts</p>
        </CardContent>
      </Card>
    )
  }

  const alerts = data?.alerts || []

  if (alerts.length === 0) {
    return (
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-success" />
            <CardTitle className="text-lg">All Caught Up!</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No items need your attention right now.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Needs Your Attention</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => {
          const style = getAlertStyle(alert.type)
          const Icon = style.icon

          return (
            <div
              key={alert.id}
              className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    style.iconBg
                  )}
                >
                  <Icon className={cn("h-4 w-4", style.iconColor)} />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {alert.title}
                </span>
              </div>
              <Link href={alert.href}>
                <Button variant="ghost" size="sm" className="text-primary">
                  {style.action}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
