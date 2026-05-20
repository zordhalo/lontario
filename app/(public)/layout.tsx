import Link from "next/link"
import { PublicHeader } from "@/components/public/public-header"
import { Toaster } from "@/components/ui/sonner"

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>
            Made by a guy trying to get a job. Possibly your next hire.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
            <Link href="/jobs" className="hover:text-foreground">
              Jobs
            </Link>
          </div>
        </div>
      </footer>
      <Toaster />
    </div>
  )
}
