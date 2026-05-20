/**
 * @fileoverview Resume storage helpers (Supabase Storage `resumes` bucket).
 *
 * Wave 2 Storage layer for the public apply flow. Anonymous applicants upload
 * resumes via short-lived signed upload URLs that we mint server-side with the
 * admin (service-role) client. Recruiters read resumes via short-lived signed
 * download URLs. All file constraints (size, MIME) are enforced both at the
 * Supabase bucket level (see `supabase/migrations/20260504_004_resumes_bucket.sql`)
 * AND in `validateResumeUpload` below (defense in depth).
 *
 * NOTE: All functions construct the admin client at call time — do not
 * initialize Supabase clients at module scope, since these helpers may run in
 * environments where env vars are loaded lazily.
 *
 * @module lib/supabase/storage
 */

import { randomUUID } from "node:crypto";

import { createAdminClient } from "./server";

/** Bucket id (must match the migration). */
const RESUMES_BUCKET = "resumes";

/** 10 MB, must match the bucket `file_size_limit`. */
const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024;

/** Allowed file extensions for resume uploads. */
export type ResumeFileExt = "pdf" | "doc" | "docx";

/** Allowed MIME types (must match the bucket `allowed_mime_types`). */
const ALLOWED_RESUME_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

type AllowedResumeMime = (typeof ALLOWED_RESUME_MIME_TYPES)[number];

/** Default validity window for signed upload URLs (5 minutes). */
const SIGNED_UPLOAD_TTL_SEC = 5 * 60;

/**
 * Build the canonical object path for a resume upload.
 * Shape: `applications/<job_id>/<random_uuid>.<ext>` — enforced at the
 * bucket policy level via a regex CHECK on `name`.
 */
function buildResumePath(jobId: string, fileExt: ResumeFileExt): string {
  return `applications/${jobId}/${randomUUID()}.${fileExt}`;
}

/**
 * Issue a short-lived signed upload URL for an anonymous resume upload.
 *
 * Called from the public apply API (Wave 3). The browser then PUTs the file
 * directly to `uploadUrl` (no Supabase JS required on the client). After a
 * successful upload, the API stores `path` on `candidates.resume_url`.
 *
 * @param params.jobId       UUID of the job being applied to.
 * @param params.fileExt     One of `pdf`, `doc`, `docx`.
 * @param params.contentType MIME type the browser will PUT with.
 * @returns Signed upload URL + the storage path that will be created, the
 *          opaque upload token, and an absolute expiry timestamp (ISO string).
 * @throws  When the admin client cannot mint the signed URL.
 */
export async function createSignedResumeUploadUrl(params: {
  jobId: string;
  fileExt: ResumeFileExt;
  contentType: string;
}): Promise<{
  uploadUrl: string;
  path: string;
  token: string;
  expiresAt: string;
}> {
  const { jobId, fileExt, contentType } = params;

  if (!ALLOWED_RESUME_MIME_TYPES.includes(contentType as AllowedResumeMime)) {
    throw new Error(`Disallowed contentType for resume upload: ${contentType}`);
  }

  const path = buildResumePath(jobId, fileExt);
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    throw new Error(
      `Failed to create signed resume upload URL: ${error?.message ?? "unknown error"}`,
    );
  }

  const expiresAt = new Date(
    Date.now() + SIGNED_UPLOAD_TTL_SEC * 1000,
  ).toISOString();

  return {
    uploadUrl: data.signedUrl,
    path: data.path ?? path,
    token: data.token,
    expiresAt,
  };
}

/**
 * Mint a short-lived signed download URL for a resume so a recruiter can view
 * a candidate's PDF/DOC in the dashboard. Uses the admin client and therefore
 * bypasses RLS — callers MUST gate this behind a recruiter authorization check.
 *
 * @param path          Storage object path (e.g. `applications/<job>/<uuid>.pdf`).
 * @param expiresInSec  Validity window in seconds. Defaults to 5 minutes.
 * @returns Public signed URL for the object.
 * @throws  When the object does not exist or the signed URL cannot be minted.
 */
export async function getSignedResumeDownloadUrl(
  path: string,
  expiresInSec = 300,
): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .createSignedUrl(path, expiresInSec);

  if (error || !data?.signedUrl) {
    throw new Error(
      `Failed to create signed resume download URL: ${error?.message ?? "unknown error"}`,
    );
  }

  return data.signedUrl;
}

/**
 * Delete a resume object from the `resumes` bucket. Admin-only. Callers must
 * authorize the request (recruiter role) before invoking.
 *
 * @param path Storage object path to delete.
 * @throws  When deletion fails at the storage layer.
 */
export async function deleteResume(path: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(RESUMES_BUCKET)
    .remove([path]);

  if (error) {
    throw new Error(`Failed to delete resume at ${path}: ${error.message}`);
  }
}

/**
 * Result of {@link validateResumeUpload}.
 */
export type ResumeUploadValidation =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validate a resume upload candidate (size + MIME) before requesting a signed
 * URL. This duplicates the bucket-level constraints to give the client a clear,
 * user-facing error and to short-circuit pointless round trips.
 *
 * @param file Subset of `File` describing the upload.
 * @returns `{ ok: true }` when valid, otherwise `{ ok: false, reason }`.
 */
export function validateResumeUpload(file: {
  name: string;
  size: number;
  type: string;
}): ResumeUploadValidation {
  if (!file.name || file.name.trim().length === 0) {
    return { ok: false, reason: "Resume file is missing a name." };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, reason: "Resume file is empty." };
  }

  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return {
      ok: false,
      reason: `Resume exceeds 10 MB limit (got ${(file.size / (1024 * 1024)).toFixed(2)} MB).`,
    };
  }

  if (!ALLOWED_RESUME_MIME_TYPES.includes(file.type as AllowedResumeMime)) {
    return {
      ok: false,
      reason: `Unsupported resume type: ${file.type || "unknown"}. Allowed: PDF, DOC, DOCX.`,
    };
  }

  return { ok: true };
}
