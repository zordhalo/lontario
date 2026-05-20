-- ============================================================
-- Migration: Waitlist table for landing-page email capture
-- Date: 2026-05-04
-- Wave: 3 (Launch — Public API)
-- ============================================================
--
-- Stores email addresses captured from the marketing landing page
-- and from the "apply disabled" fallback state. Used to notify
-- prospective candidates and to gauge demand.
--
-- Access model:
--   * anon / authenticated: NO direct access (insert, select, update, delete).
--   * The `/api/waitlist` route uses createAdminClient (service-role) to
--     INSERT — bypasses RLS.
--   * The single recruiter (is_recruiter()) can SELECT rows for triage.
--   * No UPDATE or DELETE policies — rows are immutable from the app layer.
--
-- Privacy:
--   * `ip_hash` is a SHA-256 hash (with salt) of the client IP, never the
--     raw value.
--   * `user_agent` is truncated to 1024 chars by the API layer.
-- ============================================================

BEGIN;

-- citext is required for case-insensitive UNIQUE on email.
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS public.waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       citext NOT NULL UNIQUE,
  source      text NOT NULL DEFAULT 'landing',
  user_agent  text,
  ip_hash     text,
  referrer    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Length / format constraints (defensive — API layer also validates)
-- ------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.waitlist
      ADD CONSTRAINT waitlist_email_len_chk
      CHECK (char_length(email) BETWEEN 3 AND 254);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.waitlist
      ADD CONSTRAINT waitlist_email_fmt_chk
      CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.waitlist
      ADD CONSTRAINT waitlist_source_len_chk
      CHECK (char_length(source) BETWEEN 1 AND 64);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.waitlist
      ADD CONSTRAINT waitlist_referrer_len_chk
      CHECK (referrer IS NULL OR char_length(referrer) <= 2048);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.waitlist
      ADD CONSTRAINT waitlist_user_agent_len_chk
      CHECK (user_agent IS NULL OR char_length(user_agent) <= 1024);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER TABLE public.waitlist
      ADD CONSTRAINT waitlist_ip_hash_len_chk
      CHECK (ip_hash IS NULL OR char_length(ip_hash) <= 128);
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ------------------------------------------------------------
-- Performance index — recruiter views latest signups first.
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at
  ON public.waitlist (created_at DESC);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist FORCE ROW LEVEL SECURITY;

-- Drop any pre-existing policies (idempotent re-apply).
DROP POLICY IF EXISTS waitlist_recruiter_select ON public.waitlist;
DROP POLICY IF EXISTS waitlist_no_insert        ON public.waitlist;
DROP POLICY IF EXISTS waitlist_no_update        ON public.waitlist;
DROP POLICY IF EXISTS waitlist_no_delete        ON public.waitlist;

-- Recruiter can read all rows.
CREATE POLICY waitlist_recruiter_select
  ON public.waitlist
  FOR SELECT
  TO authenticated
  USING (public.is_recruiter());

-- Note: with RLS enabled and FORCE RLS on, the absence of an INSERT/UPDATE/
-- DELETE policy means anon and authenticated cannot do those operations. The
-- service-role key bypasses RLS (FORCE RLS does NOT apply to service-role)
-- so the API route can still write. This is the intended access model.

COMMIT;
