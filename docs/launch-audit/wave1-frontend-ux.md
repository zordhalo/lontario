# Wave 1 Frontend / UX Audit — Public Apply + Recruiter Dashboard Readiness

**Date:** 2026-04-27
**Scope:** Public landing, AddCandidateDialog (proxy for future public apply form), JobDetailClient + Kanban, mobile/a11y spot checks, hooks loading/error handling, forms, toasts, placeholder copy, footer.
**Verdict (TL;DR):** The app is **NOT ready for a public job link**. The landing page is a parody portfolio piece that openly tells visitors "this isn't a real product"; there is no public-facing apply page at all (the only candidate-creation surface is `AddCandidateDialog`, which lives inside the recruiter dashboard); and the dashboard's success/error feedback is silently broken because the project ships two parallel toast systems where only one is mounted.

---

## BLOCKERS

### [BLOCKER-S] No public apply page exists
- **File**: `/Users/zordhalo/zGithub/lontario/lontario/app/` (no `apply/`, `jobs/[slug]/apply`, or `(public)/` route present)
- **Finding**: Routes are limited to `(marketing)`, `(auth)`, `(dashboard)`, `interview/[token]`, plus internal `/api`. There is no candidate-facing route a job-link recipient could land on. `AddCandidateDialog` is a recruiter-only modal mounted inside `JobDetailClient`; the closest thing the candidate would see today is the marketing site or a 404.
- **Fix**: Create a public route (e.g. `app/(public)/jobs/[slug]/apply/page.tsx`) that fetches the public-facing job snapshot (title, company, summary), renders an apply form, and posts to a new `POST /api/public/applications` endpoint. Reuse the `AddCandidateDialog` schema as the seed; strip recruiter-only fields; add explicit consent + privacy copy.
- **Wave 2 task**: Build `/jobs/[slug]/apply` public route with a candidate-first form, success state, and a public job summary header.

### [BLOCKER-S] Landing page openly declares the product is fake
- **File**: `components/landing/hero.tsx:58,76-78,105`, `components/landing/stats.tsx:3-24`, `components/landing/testimonials.tsx:11-53,164-166`, `components/landing/features.tsx:19,194-196`, `components/landing/transparency.tsx:184-194`, `components/landing/footer.tsx:127-132,243-253,261-262`, `components/landing/cta.tsx:20-22`
- **Finding**: Every section tells visitors the product is a parody/portfolio piece: hero badge says "The second-best AI recruiting agency you'll talk to this week"; trusted-by row is "Trusted by companies that don't exist yet" with Acme/Initech/Hooli/Pied Piper/Umbrella; stats brag `$0 funding`, `1 engineer`, `50 mock profiles`; testimonials are explicitly "100% fictional" with on-screen disclaimers; transparency card "Real Mission" says "Get a job at Contrario… this is the portfolio piece"; footer links are joke-toasts ("Privacy (we don't collect data)", "Terms (use at your own risk)", "Disclaimer (it's a demo)"). A real candidate clicking a job link will read "Don't actually use it for hiring" inside the first scroll.
- **Fix**: Replace landing content with copy that addresses a real candidate or recruiter audience. Remove all "fictional", "portfolio demo", "hire me" disclaimers from above-the-fold marketing. Either gate the parody copy behind a separate `/portfolio` route or rewrite the entire `components/landing/*` set with real value props, real (or omitted) social proof, real stats. If you choose to keep the parody, you must redirect job links to a candidate-only route that bypasses the landing page entirely.
- **Wave 2 task**: Rewrite hero, stats, testimonials, features, transparency, CTA, and footer with non-parody, candidate-credible copy; remove the "trusted by fake companies" section and the "Seriously, hire me" CTAs.

### [BLOCKER-M] Toast system is split-brain — most success/error feedback never renders
- **File**: `components/providers.tsx:6,45` (mounts only `sonner`'s `Toaster`); `hooks/use-toast.ts` (legacy radix store, no `<Toaster />` from `@/components/ui/toaster` mounted anywhere); used by `components/jobs/add-candidate-dialog.tsx:29`, `app/(dashboard)/jobs/[id]/JobDetailClient.tsx:36`, `components/jobs/candidate-panel.tsx:49`, `components/jobs/job-card.tsx:44`, `components/landing/footer.tsx:6`, `components/landing/navbar.tsx:8`, `components/interview/ScheduledStatusCard.tsx:43`
- **Finding**: Two parallel toast systems exist. `sonner` is mounted in `Providers`, but ~80% of the dashboard imports `useToast` from `@/hooks/use-toast` (the radix-based store). That store has no UI consumer mounted, so calls like `toast({ title: "Candidate Added" })` in AddCandidateDialog, archive/approve/reject in JobDetailClient, and every footer joke-toast silently no-op. Only `app/(dashboard)/profile/page.tsx`, `app/(dashboard)/jobs/new/page.tsx`, and `components/profile-dropdown.tsx` (which import `toast` directly from `sonner`) actually display.
- **Fix**: Pick one. Recommended: migrate every `useToast` call site to `import { toast } from "sonner"` and `toast.success(...)`, `toast.error(...)`. Then delete `hooks/use-toast.ts`, `components/ui/use-toast.ts`, `components/ui/toast.tsx`, `components/ui/toaster.tsx`. Verify AddCandidateDialog, JobDetailClient archive/approve/reject, and ScheduleDialog all surface visible feedback after the swap.
- **Wave 2 task**: Consolidate on Sonner; replace all `useToast` usages and remove dead radix toast files.

### [BLOCKER-S] Footer "legal" links are jokes — no real Privacy / Terms / Contact
- **File**: `components/landing/footer.tsx:60-79,82-86`
- **Finding**: "Privacy", "Terms", "Disclaimer" all open toasts with jokes ("We don't track you. We can barely track our own code changes.") instead of routing to real documents. The only real contact path is `mailto:hello@lontario.dev` (domain ownership unverified). LinkedIn icon links to `#`. A candidate cannot find a privacy policy before submitting personal data — this is a legal blocker for accepting applications in the EU/UK/CA.
- **Fix**: Author actual `app/(marketing)/privacy/page.tsx`, `terms/page.tsx`, `contact/page.tsx` (or external URLs) and link the footer to them. Replace the joke toasts with real `<Link>`s. Set or remove the LinkedIn href. Verify `hello@lontario.dev` is a monitored inbox.
- **Wave 2 task**: Ship `/privacy`, `/terms`, `/contact` pages and wire the footer to them as real anchor links.

---

## HIGH

### [HIGH-S] AddCandidateDialog is recruiter-shaped, not candidate-shaped
- **File**: `components/jobs/add-candidate-dialog.tsx:32-41,57-181,247-251`
- **Finding**: The schema and copy are clearly written for a recruiter pasting a candidate in: dialog title "Add New Candidate", description "Manually add a candidate to this job position. They will be added to the 'Applied' stage", `source: "manual"` defaulted, no resume upload, no consent checkbox, no "I'm applying for…" job context, no job description shown alongside, no privacy notice, no captcha/anti-spam. Optional fields (LinkedIn/GitHub/portfolio/cover letter) are ungated; AI scoring path silently no-ops if the candidate skips all three and there is no preview of what the candidate is signing up for.
- **Fix**: Build a separate `PublicApplyForm` component (do not just relabel this dialog). Required candidate-side fields: full name, email, phone (optional), location (optional), at least one of resume upload OR LinkedIn OR GitHub, cover letter / "Why this role" textarea, explicit consent checkbox referencing `/privacy`. Add Cloudflare Turnstile or hCaptcha. Add a clear post-submit success view ("We received your application, you'll hear back within X days") instead of a toast.
- **Wave 2 task**: Implement `PublicApplyForm` with resume upload, anti-spam, consent, and a candidate-friendly success screen.

### [HIGH-S] CandidatePanel ships hardcoded "Lorem Ipsum" joke copy in resume tab
- **File**: `components/jobs/candidate-panel.tsx:535`
- **Finding**: When a recruiter opens a candidate and clicks the Resume tab, the description literally reads `"(it's just Lorem Ipsum, but very professional Lorem Ipsum)"`. This is shown verbatim against any real applicant — extremely unprofessional and undermines trust the moment the recruiter reviews their first real submission.
- **Fix**: Remove the parody string. If no resume is uploaded, show an empty state ("No resume on file. Ask the candidate to upload one."). If a resume URL exists, show a real preview / download link.
- **Wave 2 task**: Replace Lorem Ipsum joke with real "no resume" empty state and wire `resume_url` to a real preview.

### [HIGH-M] Landing CTA sends the visitor straight into the recruiter dashboard
- **File**: `components/landing/hero.tsx:82-90`, `components/landing/cta.tsx:25-30`, `components/landing/navbar.tsx:131-140,178-181`
- **Finding**: "Get a demo" and "Sign in" both link to `/dashboard`. A candidate arriving from a job link who clicks any primary CTA is dumped into a recruiter Kanban board they have no business seeing (and which, per the auth-bypass note in the security audit, may even be partially accessible). There is no candidate-facing path off the landing page.
- **Fix**: Replace primary candidate-facing CTAs with `Apply now` → `/jobs/[slug]/apply`. Move "Get a demo" / "Sign in" to a recruiter sub-section or a separate `/for-recruiters` page. Detect job-link UTM/source and render a candidate-first variant of the hero.
- **Wave 2 task**: Add candidate-mode landing variant + `Apply` CTA wiring.

### [HIGH-S] JobDetailClient has no error state for the candidates query
- **File**: `app/(dashboard)/jobs/[id]/JobDetailClient.tsx:65-66,80-83,408-426`
- **Finding**: `useJob` errors are handled (lines 237-253), but `useCandidates` only handles `isLoading`. If `candidatesData` fetch fails (network blip, 500, RLS denial), `candidatesData?.candidates` falls through as `undefined`, `candidates` becomes `[]`, and the recruiter sees a fully empty Kanban with no indication anything went wrong. They will assume "no applicants yet" instead of "the API is down".
- **Fix**: Read `error` and `isError` from `useCandidates`; render an inline error banner above the Kanban with retry. Also surface `moveCandidate.error` (currently the catch on line 128 silently reverts state without telling the user).
- **Wave 2 task**: Add error banners for candidate-list fetch and move-mutation failures.

### [HIGH-S] Drag-and-drop kanban has no keyboard / touch path
- **File**: `components/jobs/kanban-board.tsx:61-83,85-87`
- **Finding**: Stage transitions rely on native HTML5 `draggable` (`onDragStart` / `onDrop`). This is non-functional on touch devices (iOS/Android won't fire drag events on the card body) and inaccessible to keyboard users. The only stage-change fallback for a recruiter on mobile is the per-card "approve/reject" buttons, which advance one stage at a time. Outer container is `overflow-x-auto` with 9 columns at `w-72` each — the board is ~648px just for columns and is essentially unusable below ~lg without horizontal panning.
- **Fix**: Replace native DnD with `dnd-kit` (touch + keyboard). Add a per-card stage `<Select>` as a non-DnD fallback. On mobile, switch from horizontal Kanban to a single-column list grouped by stage with a stage filter dropdown.
- **Wave 2 task**: Migrate Kanban to `dnd-kit` and add a mobile list view variant.

### [HIGH-M] No public-facing application success / confirmation experience
- **File**: `components/jobs/add-candidate-dialog.tsx:202-246`
- **Finding**: The "scoring complete" overlay closes the dialog and shows the AI match score (`{scoringState.score}% Match`) to whoever submitted. If this dialog were ever shown to a candidate (or a near-copy used as the public form), the candidate would see their own AI-match percentage, which is internal recruiter data and a disaster vector for bias claims, GDPR Article 22 challenges, and bad press.
- **Fix**: Build a separate post-application thank-you page that *never* shows AI score, status, or rejection reasons to the applicant. Keep the AI scoring overlay as a recruiter-only experience inside the dialog.
- **Wave 2 task**: Ensure the public apply flow's success page does not leak `ai_score`, `ai_summary`, `rejection_reason`, or any internal pipeline data.

---

## MEDIUM

### [MED-S] Hero "trusted by" companies are obvious fake brand parodies
- **File**: `components/landing/hero.tsx:16-22`
- **Finding**: Acme, Initech, Hooli, Pied Piper, Umbrella with comedy tooltips. Even on a non-parody version of the site this would read as filler. No real candidate considers any of these a credibility signal.
- **Fix**: Either replace with real logos (with permission) or delete the section.
- **Wave 2 task**: Remove or replace the Trusted-By row with verifiable logos.

### [MED-S] Stats section flexes "$0 funding / 1 engineer / 50 mock profiles"
- **File**: `components/landing/stats.tsx:3-24`
- **Finding**: Even the "real" stats are negative signals to a candidate (1 engineer, 50 mock profiles, ramen budget). For a hiring product these reduce trust.
- **Fix**: Replace with relevant candidate-side metrics (avg time-to-response, % of candidates that hear back, # active roles) or remove the section entirely until you have real numbers.
- **Wave 2 task**: Replace stats with metrics that matter to applicants, or hide the section.

### [MED-S] Features stats footnoted as fake
- **File**: `components/landing/features.tsx:22-24,67-68,96-98,124-127`
- **Finding**: Each feature card has a tooltip undercutting its own stat ("Sample size: 0 customers. But the math checks out", "Industry average is 42:1. We made up both numbers"). Charming in a portfolio piece, fatal for a public hiring brand.
- **Fix**: Either remove the stats and statTooltip fields, or replace with real values.
- **Wave 2 task**: Strip the self-deprecating tooltip data and real-vet remaining stats.

### [MED-S] Navbar logo easter egg + "active section" scrollspy on a hidden parody
- **File**: `components/landing/navbar.tsx:11-16,55-78,131-140`
- **Finding**: Navbar is fine structurally but advertises section anchors (`#testimonials`, `#transparency`) that are themselves parody sections. Logo's 5-click easter egg is harmless but only fires a joke toast — at minimum, this needs the toaster fix above.
- **Fix**: Once landing is rewritten, audit the section anchors. Decide whether the logo easter egg ships in production.
- **Wave 2 task**: Re-audit navbar after landing rewrite.

### [MED-S] Mobile responsiveness of recruiter dashboard is poor
- **File**: `components/jobs/kanban-board.tsx:86-87`, `components/jobs/candidate-panel.tsx:259`, `components/dashboard/activity-dialog.tsx:75`, `app/(dashboard)/jobs/[id]/JobDetailClient.tsx:289,408-446`
- **Finding**: Kanban scrolls horizontally with 9 wide columns. Candidate panel is `max-w-[70vw] w-[70vw] h-[85vh]` — a fixed 70% viewport on every breakpoint, including phones (where 70vw of 390px = 273px is too narrow for a tabbed candidate detail view, but the height pegs at 85vh and clips the side bar). Activity dialog uses the same fixed `70vw`. Header in `JobDetailClient` (`px-4 py-4` with breadcrumb + title + status badge + 2 action buttons inline) wraps awkwardly on phones because the action button group is `flex items-center gap-2` with no `flex-wrap`.
- **Fix**: Convert Kanban to a vertical list at `<lg`. Make `CandidatePanel` and `activity-dialog` use a responsive sheet (`Drawer` from bottom on mobile, `Dialog` on desktop). Add `flex-wrap` and stacking to the JobDetailClient header.
- **Wave 2 task**: Mobile pass on Kanban, CandidatePanel, ActivityDialog, JobDetailClient header.

### [MED-S] Form validation messages are generic / inconsistent
- **File**: `components/jobs/add-candidate-dialog.tsx:32-41`
- **Finding**: zod messages like `"Invalid URL"`, `"Invalid email address"`, `"Name must be at least 2 characters"` are functional but inconsistent with each other and unhelpful for candidates. There is no max length, no phone format hint beyond placeholder, no client-side allow-list for LinkedIn/GitHub URLs (any URL passes). No async uniqueness check on email.
- **Fix**: Standardize messages ("Please enter a valid email address.", "Your name needs to be at least 2 characters.", "Please paste your full LinkedIn URL, e.g. https://linkedin.com/in/your-handle"). Add `.max(...)` bounds. Add LinkedIn/GitHub host regex. Consider async unique-email check.
- **Wave 2 task**: Tighten validation copy + add domain regex on social URL fields.

### [MED-M] AI scoring overlay can deadlock the dialog for 30s with no escape
- **File**: `components/jobs/add-candidate-dialog.tsx:183-194,216-218`
- **Finding**: While `isProcessing`, the dialog's `onOpenChange` is locked closed and the overlay only displays "This may take up to 30 seconds…" — there is no Cancel button on the overlay, and the underlying form is blocked. If polling exceeds 15 attempts × 2s = 30s, `pollCandidateUntilScored` returns `null`, the toast (which doesn't render due to BLOCKER-M) "AI scoring is still processing" fires, and the user only sees the dialog suddenly close with no idea what happened.
- **Fix**: Add a "Continue without scoring" cancel button on the overlay. Show a visible result fallback ("Candidate added — AI scoring still running, check back in a minute") inline rather than via toast.
- **Wave 2 task**: Add cancel + visible fallback to scoring overlay.

### [MED-S] Empty-state copy in Kanban is parody
- **File**: `components/jobs/kanban-board.tsx:20-30`
- **Finding**: All 9 column empty states have humor copy ("No new applicants. Time to polish that job description?", "Office is quiet. Too quiet."). Acceptable internally, but if a recruiter just got their first real applicant and 8 of 9 columns are empty, the snark dominates the board.
- **Fix**: Tone down to neutral one-liners. Reserve humor for the "rejected" column at most.
- **Wave 2 task**: Rewrite empty-state strings to neutral copy.

### [MED-S] ARIA labeling and focus rings on form fields
- **File**: `components/ui/input.tsx:11`, `components/ui/textarea.tsx:10`, `components/ui/select.tsx:40`, `components/jobs/add-candidate-dialog.tsx:265-407`
- **Finding**: shadcn/ui primitives include `focus-visible:ring-ring/50` and `aria-invalid` styles — that's good. However, `FormLabel` in AddCandidateDialog is a `<label>` with the icon + text inline; there is no `htmlFor`/`id` association explicit beyond shadcn's `Form` machinery which relies on the field name. Required fields are marked with `*` text only, no `aria-required`. The "scoring overlay" (line 203-246) is rendered as a div sibling without `role="status"` / `aria-live="polite"`, so screen readers don't announce progress.
- **Fix**: Confirm `Form` field IDs are wired (they should be via shadcn). Add `aria-required="true"` on full_name and email inputs. Add `role="status"` and `aria-live="polite"` to the scoring overlay container.
- **Wave 2 task**: Accessibility pass on AddCandidateDialog (required attrs, live regions).

### [MED-S] Landing page mounts ~7 client components in a single page; no SSR data
- **File**: `app/(marketing)/page.tsx:1-25`
- **Finding**: Every landing section is `"use client"` even though most are static. First contentful paint is fine but unnecessary JS ships. Hero scrollspy/word-rotator + testimonials auto-scroll runs `requestAnimationFrame` continuously which drains battery on mobile.
- **Fix**: Convert static sections (Stats, Features visuals, Transparency, CTA, Footer columns) to server components. Pause testimonials' rAF loop when off-screen.
- **Wave 2 task**: Server-component split + pause-when-hidden on testimonials.

---

## LOW

### [LOW-S] Hardcoded social/contact addresses
- **File**: `components/landing/footer.tsx:57-58,83-85,245`, `components/landing/hero.tsx:91`, `components/landing/cta.tsx:31`
- **Finding**: GitHub URLs hardcoded to `https://github.com/zordhalo/lontario-YC`. Email is `hello@lontario.dev` (domain mailbox status unknown). LinkedIn is `#`.
- **Fix**: Move URLs to a single `lib/links.ts` constant. Verify mailbox + LinkedIn URL or remove icons.
- **Wave 2 task**: Centralize external links and verify deliverability.

### [LOW-S] Footer disclaimer "Not affiliated with Contrario. Just admiring."
- **File**: `components/landing/footer.tsx:131`
- **Finding**: References a competitor by name. Fine for a portfolio piece, but inappropriate for a real product footer.
- **Fix**: Remove on the rewrite.
- **Wave 2 task**: Strip Contrario reference.

### [LOW-S] CTA section claims "MIT Licensed / Open Source / Documentation Included"
- **File**: `components/landing/cta.tsx:39-51`
- **Finding**: Pitches the codebase to a candidate visitor, who doesn't care.
- **Fix**: Replace with candidate-relevant chips ("Free to apply", "Hear back in 7 days", "GDPR-compliant").
- **Wave 2 task**: Rewrite CTA badges.

### [LOW-S] Stats / Hero numbers animate but never reach a real number
- **File**: `components/landing/stats.tsx:14-23`, `components/landing/features.tsx:18-22`
- **Finding**: Hard-coded strings, no count-up animation, no real backing number. Cosmetic only.
- **Fix**: Either wire to `/api/stats` (when one exists) or simplify.
- **Wave 2 task**: Wire stats to real metrics or freeze.

### [LOW-S] `next/image` on Footer logo and testimonials uses `/placeholder.svg` fallback
- **File**: `components/landing/testimonials.tsx:217`, `components/landing/footer.tsx:117-122`
- **Finding**: Testimonial avatars fall back to `/placeholder.svg` if `image` is missing. Public folder may or may not have those `/images/testimonial-N.jpg` files.
- **Fix**: Verify all referenced images exist in `public/images/`. Replace `/placeholder.svg` fallback with real initials avatars.
- **Wave 2 task**: Audit `public/images/` against landing references; add an initials fallback.

### [LOW-S] Backend TODOs touch user-visible flows
- **File**: `app/api/interviews/[id]/route.ts:192,323`, `app/api/interviews/schedule/route.ts:308-312`, `app/api/interviews/[id]/review/route.ts:79`
- **Finding**: `// TODO: Send reschedule notification email`, `// TODO: Send cancellation notification email`, `// TODO: Send email notification if send_immediate_invite is true`. Frontend toasts say "They will receive an email invitation." (`JobDetailClient.tsx:201`) but the backend doesn't send them. Recruiter is misled.
- **Fix**: Either implement transactional email or change the toast/UX to say "Email invitation will be available soon — please contact the candidate manually."
- **Wave 2 task**: Implement transactional email via Resend/Postmark, or fix copy to match reality.

### [LOW-S] Sentry-example route is shipped at `/sentry-example-page`
- **File**: `app/sentry-example-page/page.tsx:107,215`
- **Finding**: Default Sentry boilerplate page (with a deliberately-throwing button) is publicly reachable. Not a security issue but a brand/UX issue if indexed.
- **Fix**: Delete the route or `noindex` + dev-only guard.
- **Wave 2 task**: Remove or gate Sentry example page.

### [LOW-S] No skip-link / no `<main>` landmark in dashboard
- **File**: `app/(dashboard)/layout.tsx`, `app/(dashboard)/jobs/[id]/JobDetailClient.tsx:288-472`
- **Finding**: JobDetailClient renders a `<header>` and a `<Tabs>` block but no `<main>`. No skip-link in the layout. Marketing layout is fine (`<main className="min-h-screen…">`).
- **Fix**: Add `<main role="main">` wrapper inside the dashboard layout and a "Skip to main content" link in `app-header.tsx`.
- **Wave 2 task**: A11y landmarks + skip link in dashboard chrome.

### [LOW-S] Color-only state signals on Job status badges
- **File**: `app/(dashboard)/jobs/[id]/JobDetailClient.tsx:52-57,317-322`
- **Finding**: Status uses `bg-success/10 text-success` etc. with the literal status word. Acceptable contrast under default tokens, but `text-success` and `text-warning` against `bg-*-/10` are typically ~3-3.5:1 (below WCAG AA 4.5:1 for body text). Should be verified.
- **Fix**: Run an axe/contrast check; if failing, darken the text token or boost background opacity.
- **Wave 2 task**: Contrast pass on success/warning/destructive badge variants.

### [LOW-S] CandidatePanel uses fixed-height `h-[85vh]` everywhere
- **File**: `components/jobs/candidate-panel.tsx:259`
- **Finding**: On a 700px-tall laptop the panel pegs at 595px and clips long resumes/timelines.
- **Fix**: Use `max-h-[85vh] h-auto` plus internal `overflow-y-auto`.
- **Wave 2 task**: Loosen panel height.

### [LOW-S] React-Hook-Form + zod is consistent in *forms* but not used everywhere
- **File**: Searched: only `add-candidate-dialog.tsx`, `(auth)/register/page.tsx`, `(auth)/login/login-form.tsx`, `(auth)/forgot-password/page.tsx`, `(auth)/reset-password/page.tsx` use RHF. `(dashboard)/jobs/new/page.tsx` and `(dashboard)/profile/page.tsx` do not — they use `useState`-driven forms with manual validation (toast.error on missing fields).
- **Fix**: Standardize on RHF+zod for the new-job and profile forms.
- **Wave 2 task**: Migrate `jobs/new` and `profile` to RHF+zod.

### [LOW-S] No debounce / deduplication on AddCandidateDialog submit
- **File**: `components/jobs/add-candidate-dialog.tsx:419-422`
- **Finding**: `disabled={isProcessing}` covers double-click but not the React-StrictMode double-fire in dev or rapid Enter presses before state updates.
- **Fix**: Disable on `form.formState.isSubmitting`.
- **Wave 2 task**: Tighten submit guard.

---

## First-Impression Report Card — what a candidate sees today

A candidate clicking a job link from a recruiter today would land on `/dashboard` (because that's where every CTA points) — likely 404 or a recruiter Kanban they have no business in. If they instead landed on `/` (the marketing home), here is the experience in order:

1. **Within 3 seconds**, they read "The second-best AI recruiting agency you'll talk to this week" and "Trusted by companies that don't exist yet" with logos for Acme/Initech/Pied Piper. **Trust collapses.**
2. **Within 10 seconds**, the Stats band tells them the company has $0 funding, 1 engineer, and 50 mock profiles. They scroll.
3. **Within 30 seconds**, the Testimonials section auto-scrolls real-looking quotes labeled "These testimonials are 100% fictional, just like our recruiting network."
4. **Around the Transparency section**, a card titled "Real Mission" tells them the entire site exists so the developer can get a job at Contrario.
5. **In the footer**, every legal link opens a joke toast — except the toaster is broken, so nothing happens at all. The CTA is "Seriously though, hire me" with the developer's email.
6. **They cannot find a privacy policy, an apply button, or a way to submit their application.**

If the same candidate somehow reached the recruiter dashboard's AddCandidateDialog (which is the only candidate-creation path that exists), they would see: "Manually add a candidate to this job position. They will be added to the 'Applied' stage." After submission, an "AI Screening in Progress" overlay would tell them their match score (`72% Match`), and the dialog would close. They'd be left wondering what just happened.

### Minimum viable changes (Wave 2 must-haves)

1. **Build an actual public apply route** at `/jobs/[slug]/apply` with a candidate-shaped form, consent, captcha, and a thank-you page that **never** displays AI score.
2. **Rewrite landing page** (or gate parody behind `/portfolio`): remove all "fictional", "fake", "hire me", and competitor references; replace CTAs with `Apply now` (candidate) / `For employers` (recruiter).
3. **Fix the toast system**: consolidate on Sonner so AddCandidateDialog, JobDetailClient, archive/approve/reject feedback actually appears.
4. **Remove the Lorem Ipsum joke** in `CandidatePanel` resume tab and replace with a real empty state.
5. **Ship real `/privacy`, `/terms`, `/contact` pages** and link them from the footer with real anchors (not toasts).
6. **Add candidate-list error state** to JobDetailClient so recruiters don't mistake API failure for "no applicants".
7. **Fix mobile Kanban / CandidatePanel**: vertical list under `lg`, drawer on mobile, dnd-kit for touch + a11y.
8. **Fix the misleading "email invitation" copy** in JobDetailClient's `handleScheduled` to match the fact that backend email is still TODO.

Until at least items 1, 2, 3, 4, and 5 ship, do not send a real candidate a public job link.
