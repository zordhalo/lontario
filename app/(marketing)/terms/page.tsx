import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms — Lontario",
  description: "The short version of the rules for using Lontario.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background">
      <article className="mx-auto max-w-2xl px-6 lg:px-8 py-16 sm:py-24">
        <p className="text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← Back to Lontario
          </Link>
        </p>
        <h1 className="mt-6 text-3xl sm:text-4xl font-bold text-foreground">
          Terms
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: 2026-05-04
        </p>

        <div className="mt-8 space-y-6 text-base text-foreground/90 leading-relaxed">
          <p>
            By using Lontario, you agree to the short list of rules below. If you don&apos;t,
            don&apos;t use the site.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-foreground">What you can do</h2>
            <p className="mt-3">
              You can browse open roles, apply to any of them, and join the waitlist. The
              information you submit is used to evaluate your application and to contact you about
              it. See the{" "}
              <Link
                href="/privacy"
                className="text-accent hover:text-accent/80 underline underline-offset-4"
              >
                privacy page
              </Link>{" "}
              for the data side of things.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">No guarantees</h2>
            <p className="mt-3">
              Applying does not guarantee a response, an interview, or an offer. The site is
              provided as-is. We will try to keep it working, but we make no warranty that it will
              be available, accurate, or bug-free.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">House rules</h2>
            <p className="mt-3">
              Don&apos;t submit other people&apos;s information without their consent. Don&apos;t
              try to break, scrape, or overload the site. We can refuse service to anyone who
              abuses the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Governing law</h2>
            <p className="mt-3">
              These terms are governed by the laws of the Province of Ontario, Canada. Any
              disputes will be resolved in the courts of Ontario.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Contact</h2>
            <p className="mt-3">
              Questions, complaints, or notices:{" "}
              <a
                href="mailto:brian@creatin.ca"
                className="text-accent hover:text-accent/80 underline underline-offset-4"
              >
                brian@creatin.ca
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
