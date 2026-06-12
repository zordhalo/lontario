import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
          aria-label="Lontario home"
        >
          <Image
            src="/images/logo.jpg"
            alt=""
            width={28}
            height={28}
            className="rounded-md"
          />
          <span className="text-base font-semibold text-foreground">
            lontario
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/jobs"
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
          >
            Jobs
          </Link>
          <Link
            href="/#waitlist"
            className="hidden sm:inline-flex"
          >
            <Button
              size="sm"
              variant="outline"
              className="rounded-full border-accent/40 text-foreground hover:border-accent hover:bg-accent/10 hover:text-accent"
            >
              Join the waitlist
            </Button>
          </Link>
        </div>
      </nav>
    </header>
  )
}
