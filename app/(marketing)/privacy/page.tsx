import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy — Lontario",
  description: "What Lontario collects, why, and how to get it deleted.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <article className="mx-auto max-w-2xl px-6 lg:px-8 py-16 sm:py-24">
        <p className="text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← Back to Lontario
          </Link>
        </p>
        <h1 className="mt-6 text-3xl sm:text-4xl font-bold text-foreground">
          Privacy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: 2026-05-04
        </p>

        <div className="mt-8 space-y-6 text-base text-foreground/90 leading-relaxed">
          <p>
            Lontario is a small operation run by one person. This page explains, in plain English,
            what we collect about you and what we do with it. If anything here is unclear, email{" "}
            <a
              href="mailto:brian@creatin.ca"
              className="text-accent hover:text-accent/80 underline underline-offset-4"
            >
              brian@creatin.ca
            </a>{" "}
            and we&apos;ll sort it out.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-foreground">What we collect</h2>
            <ul className="mt-3 list-disc pl-6 space-y-2">
              <li>
                <strong>Email address</strong> — when you join the waitlist or apply to a job.
              </li>
              <li>
                <strong>Application details</strong> — name, contact info, resume/links, and
                anything else you put in the form when you apply to a posted role.
              </li>
              <li>
                <strong>A hashed version of your IP address</strong> — used only for rate limiting
                so people can&apos;t spam the forms. We don&apos;t store the raw IP.
              </li>
              <li>
                <strong>Error telemetry</strong> — when something crashes, Sentry collects a stack
                trace and basic request metadata so we can fix it. We do not send your form
                contents to Sentry on purpose.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Why we collect it</h2>
            <p className="mt-3">
              To evaluate your job application, to email you back about the waitlist, and to keep
              the site from falling over. That&apos;s it. We do not sell your data, we don&apos;t
              run ad trackers on this site, and we don&apos;t share what you submit with anyone
              outside Lontario.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">How long we keep it</h2>
            <p className="mt-3">
              Waitlist emails: until you ask us to remove them. Job applications: kept for as long
              as the role is open, plus a reasonable window after, in case we want to revisit. Ask
              us to delete your data at any time and we will.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground">Deletion and questions</h2>
            <p className="mt-3">
              Email{" "}
              <a
                href="mailto:brian@creatin.ca"
                className="text-accent hover:text-accent/80 underline underline-offset-4"
              >
                brian@creatin.ca
              </a>{" "}
              from the address you signed up with and we&apos;ll remove your information within a
              few business days.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
