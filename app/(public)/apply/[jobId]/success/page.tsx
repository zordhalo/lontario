import Link from "next/link"
import type { Metadata } from "next"
import { CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Application received | Lontario",
  robots: { index: false, follow: false },
}

export default async function ApplySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  const { email } = await searchParams
  const safeEmail =
    typeof email === "string" && email.length > 0 && email.length <= 320
      ? email
      : null

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 sm:py-24">
      <Card>
        <CardContent className="space-y-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <CheckCircle2 className="h-6 w-6 text-accent" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Thanks — we got it.
            </h1>
            <p className="text-sm text-muted-foreground">
              {safeEmail ? (
                <>
                  You&apos;ll hear from us at{" "}
                  <span className="font-medium text-foreground">
                    {safeEmail}
                  </span>
                  .
                </>
              ) : (
                <>You&apos;ll hear from us by email.</>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              A real human reviews every application. Give it a day or two.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 pt-2 sm:flex-row">
            <Link href="/jobs">
              <Button variant="outline" className="rounded-full">
                Browse more jobs
              </Button>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="rounded-full">
                Back home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
