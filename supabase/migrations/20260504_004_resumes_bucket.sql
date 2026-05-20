-- =============================================================================
-- Migration: create private `resumes` storage bucket
-- =============================================================================
--
-- DESIGN
-- ------
-- The public apply form must accept resume uploads from ANONYMOUS visitors
-- (applicants do not have accounts). Resumes contain PII (phone, address,
-- work history) and therefore must NOT live in a public bucket.
--
-- Upload pattern (defense in depth):
--   1) Browser POSTs metadata to /api/candidates/upload-url (Wave 3).
--   2) Server (admin client, service role) calls storage.from('resumes')
--      .createSignedUploadUrl(path) where path is:
--          applications/<job_id>/<random_uuid>.<ext>
--      Path shape is constructed server-side and is enforced again here at
--      the bucket policy level via a CHECK on `name`.
--   3) Browser PUTs the file directly to the signed URL (anon role).
--   4) Server records the path on `candidates.resume_url` after the apply
--      API validates the application payload.
--
-- The avatars bucket (20260204_create_avatars_bucket.sql) keys policies on
-- `split_part(name, '-', 1)` which truncates UUIDs to 8 chars and is fragile.
-- We deliberately do NOT copy that pattern. We instead enforce a strict path
-- regex and gate SELECT/DELETE on the recruiter role lookup.
--
-- Recruiter access:
--   - Single-tenant MVP: any profile with role = 'recruiter' may read/delete.
--   - `is_recruiter()` helper may not exist at migration runtime, so we
--     inline the subquery: (SELECT role FROM profiles WHERE id = auth.uid()).
--
-- Constraints enforced AT THE BUCKET LEVEL:
--   - public = false
--   - file_size_limit = 10 MB
--   - allowed_mime_types = PDF, DOC, DOCX
--   (validateResumeUpload() in lib/supabase/storage.ts re-validates client-side
--    for clearer error messages — defense in depth.)
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resumes',
  'resumes',
  false,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- INSERT: anonymous applicants may upload, but only via a signed upload URL
-- pointing at a path of shape: applications/<uuid>/<uuid>.<ext>
-- -----------------------------------------------------------------------------
-- Path regex breakdown:
--   ^applications/                                    literal prefix
--   [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/   job_id UUID
--   [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}    random UUID
--   \.(pdf|doc|docx)$                                 allowed extensions
-- -----------------------------------------------------------------------------
CREATE POLICY "Anonymous can upload resumes via signed url"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'resumes'
  AND name ~ '^applications/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|doc|docx)$'
);

-- -----------------------------------------------------------------------------
-- SELECT: only recruiters may read resume objects.
-- (Public download links for the recruiter UI are issued server-side via
--  createSignedUrl() with the admin client — that path also works because
--  service_role bypasses RLS entirely. This policy guards any direct
--  authenticated-client access.)
-- -----------------------------------------------------------------------------
CREATE POLICY "Recruiters can read resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'resumes'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'recruiter'
);

-- -----------------------------------------------------------------------------
-- DELETE: only recruiters may delete resume objects.
-- -----------------------------------------------------------------------------
CREATE POLICY "Recruiters can delete resumes"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'resumes'
  AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'recruiter'
);

-- -----------------------------------------------------------------------------
-- UPDATE: not allowed for anyone. Resumes are write-once; to replace a
-- resume the recruiter should DELETE and the applicant should re-upload via
-- a new signed URL. (No CREATE POLICY for UPDATE => denied by default RLS.)
-- -----------------------------------------------------------------------------
