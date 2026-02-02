"use client"

import { Component, ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary component for the interview feature
 * Catches errors and displays a user-friendly error UI
 */
export class InterviewErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    console.error("Interview error:", error, errorInfo)

    // In production, you might want to send this to an error tracking service
    // Example: Sentry.captureException(error)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="max-w-lg mx-auto mt-8">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              An unexpected error occurred in the interview generator
            </CardDescription>
          </CardHeader>
          <CardContent>
            {this.state.error && (
              <div className="rounded-lg border bg-muted p-3 text-sm">
                <p className="font-medium text-foreground">Error details:</p>
                <p className="mt-1 text-muted-foreground wrap-break-word">
                  {this.state.error.message}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-3 justify-center">
            <Button variant="outline" onClick={this.handleRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={this.handleReload}>Reload Page</Button>
          </CardFooter>
        </Card>
      )
    }

    return this.props.children
  }
}

/**
 * Inline error display component for non-fatal errors
 */
export function ErrorAlert({
  error,
  onDismiss,
  onRetry,
}: {
  error: string
  onDismiss?: () => void
  onRetry?: () => void
}) {
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-destructive">Error</p>
          <p className="mt-1 text-sm text-destructive/80">{error}</p>
        </div>
        <div className="flex gap-2">
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="text-destructive hover:text-destructive"
            >
              Retry
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-destructive hover:text-destructive"
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
