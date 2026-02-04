-- ============================================================
-- Migration: Fix Candidate Delete RLS Policy
-- Description: Update DELETE policy to allow recruiters+ to delete
--              candidates, aligning with UPDATE policy permissions
-- Date: 2026-02-04
-- ============================================================

-- Drop the old restrictive policy that only allowed admins
DROP POLICY IF EXISTS "Admins can delete candidates" ON candidates;

-- Create new policy allowing recruiters and above to delete candidates
-- This matches the UPDATE policy and aligns with the MVP auth approach
CREATE POLICY "Recruiters can delete org candidates"
  ON candidates FOR DELETE
  TO authenticated
  USING (
    public.is_recruiter_or_above()
    AND public.user_owns_job(job_id)
  );

-- Add documentation
COMMENT ON POLICY "Recruiters can delete org candidates" ON candidates IS
'Recruiters, hiring managers, and admins can delete candidates for jobs in their organization';
