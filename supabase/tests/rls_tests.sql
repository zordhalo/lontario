-- ============================================================
-- RLS Test Scripts for Lontario AI Hiring Platform
-- ============================================================
--
-- This file contains test queries to verify RLS policies work correctly.
-- Run these tests after applying the RLS migrations.
--
-- TEST METHODOLOGY:
-- 1. Create test users with different roles
-- 2. Use SET ROLE to simulate different user contexts
-- 3. Verify expected access patterns for each role
--
-- IMPORTANT: Run these tests in a non-production environment!
-- ============================================================


-- ============================================================
-- SETUP: Create Test Data
-- ============================================================

-- First, ensure we have the test organization and users
-- These should be run with service_role or as superuser

-- Create test organization (for testing org-based access)
DO $$
DECLARE
  test_org_id UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
  test_org_2_id UUID := 'a0000000-0000-0000-0000-000000000002'::UUID;
BEGIN
  -- Note: You may need to create an organizations table first
  -- For now, we use organization_id in profiles

  -- Clean up any existing test data
  DELETE FROM notifications WHERE user_id IN (
    SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
  );
  DELETE FROM candidate_comments WHERE author_id IN (
    SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
  );
  DELETE FROM interview_questions WHERE interview_id IN (
    SELECT ai.id FROM ai_interviews ai
    JOIN jobs j ON j.id = ai.job_id
    JOIN profiles p ON p.id = j.created_by
    WHERE p.email LIKE 'test_%@example.com'
  );
  DELETE FROM ai_interviews WHERE job_id IN (
    SELECT id FROM jobs WHERE created_by IN (
      SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
    )
  );
  DELETE FROM candidate_activity WHERE candidate_id IN (
    SELECT c.id FROM candidates c
    JOIN jobs j ON j.id = c.job_id
    WHERE j.created_by IN (
      SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
    )
  );
  DELETE FROM candidates WHERE job_id IN (
    SELECT id FROM jobs WHERE created_by IN (
      SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
    )
  );
  DELETE FROM pregenerated_questions WHERE job_id IN (
    SELECT id FROM jobs WHERE created_by IN (
      SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
    )
  );
  DELETE FROM jobs WHERE created_by IN (
    SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
  );
  DELETE FROM profiles WHERE email LIKE 'test_%@example.com';
END $$;


-- ============================================================
-- TEST 1: JOBS TABLE ACCESS
-- ============================================================

-- Test 1.1: Anonymous users can view published jobs
-- Expected: Returns only active, non-archived jobs
DO $$
DECLARE
  job_count INTEGER;
BEGIN
  -- Count published jobs (should work for anon)
  SELECT COUNT(*) INTO job_count FROM jobs
  WHERE status = 'active' AND is_archived = false;

  RAISE NOTICE 'Test 1.1: Anonymous can view published jobs - Found % active jobs', job_count;
END $$;

-- Test 1.2: Create test recruiter and verify job access
DO $$
DECLARE
  test_recruiter_id UUID := 'b0000000-0000-0000-0000-000000000001'::UUID;
  test_job_id UUID;
  job_count INTEGER;
BEGIN
  -- Create test recruiter profile
  INSERT INTO profiles (id, email, full_name, role, organization_id, timezone, notification_preferences, created_at, updated_at)
  VALUES (
    test_recruiter_id,
    'test_recruiter@example.com',
    'Test Recruiter',
    'recruiter',
    'a0000000-0000-0000-0000-000000000001'::UUID,
    'UTC',
    '{}',
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Create a draft job (should only be visible to org members)
  INSERT INTO jobs (
    id, created_by, title, slug, description, required_skills, nice_to_have_skills,
    status, is_archived, salary_currency, is_featured, show_salary, require_cover_letter,
    require_linkedin, require_github, ai_generated_description, total_applicants,
    active_candidates, screening_questions, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(),
    test_recruiter_id,
    'Test Draft Job',
    'test-draft-job',
    'This is a test draft job for RLS testing',
    ARRAY['TypeScript', 'React'],
    ARRAY['Node.js'],
    'draft',
    false,
    'USD',
    false,
    false,
    false,
    false,
    false,
    false,
    0,
    0,
    '[]',
    NOW(),
    NOW()
  ) RETURNING id INTO test_job_id;

  RAISE NOTICE 'Test 1.2: Created test job with ID %', test_job_id;
END $$;

-- Test 1.3: Verify candidate cannot see draft jobs
DO $$
DECLARE
  test_candidate_id UUID := 'c0000000-0000-0000-0000-000000000001'::UUID;
  draft_job_count INTEGER;
BEGIN
  -- Create test candidate profile
  INSERT INTO profiles (id, email, full_name, role, timezone, notification_preferences, created_at, updated_at)
  VALUES (
    test_candidate_id,
    'test_candidate@example.com',
    'Test Candidate',
    'candidate',
    'UTC',
    '{}',
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- As candidate, draft jobs should not be visible
  -- This would need to be tested with actual auth context
  RAISE NOTICE 'Test 1.3: Candidate role created - verify cannot see draft jobs';
END $$;


-- ============================================================
-- TEST 2: CANDIDATES TABLE ACCESS
-- ============================================================

-- Test 2.1: Create candidate application and verify access
DO $$
DECLARE
  test_job_id UUID;
  test_candidate_record_id UUID;
BEGIN
  -- Get a test job
  SELECT id INTO test_job_id FROM jobs
  WHERE created_by = 'b0000000-0000-0000-0000-000000000001'::UUID
  LIMIT 1;

  IF test_job_id IS NOT NULL THEN
    -- Create candidate application
    INSERT INTO candidates (
      id, job_id, email, full_name, stage, source, is_starred, is_archived,
      applied_at, last_activity_at, created_at, updated_at, screening_answers,
      ai_score_breakdown
    )
    VALUES (
      gen_random_uuid(),
      test_job_id,
      'test_candidate@example.com',
      'Test Candidate',
      'applied',
      'direct',
      false,
      false,
      NOW(),
      NOW(),
      NOW(),
      NOW(),
      '{}',
      '{}'
    ) RETURNING id INTO test_candidate_record_id;

    RAISE NOTICE 'Test 2.1: Created candidate application with ID %', test_candidate_record_id;
  ELSE
    RAISE NOTICE 'Test 2.1: No test job found to create candidate';
  END IF;
END $$;

-- Test 2.2: Verify candidate can only see own applications
DO $$
BEGIN
  -- When querying as the test candidate, should only see their own applications
  -- This requires actual auth context to test properly
  RAISE NOTICE 'Test 2.2: Verify candidate can only view own applications (requires auth context)';
END $$;


-- ============================================================
-- TEST 3: AI_INTERVIEWS TABLE ACCESS
-- ============================================================

-- Test 3.1: Create interview and verify access patterns
DO $$
DECLARE
  test_candidate_id UUID;
  test_job_id UUID;
  test_interview_id UUID;
BEGIN
  -- Get test candidate and job
  SELECT c.id, c.job_id INTO test_candidate_id, test_job_id
  FROM candidates c
  JOIN jobs j ON j.id = c.job_id
  WHERE j.created_by = 'b0000000-0000-0000-0000-000000000001'::UUID
  LIMIT 1;

  IF test_candidate_id IS NOT NULL THEN
    -- Create interview
    INSERT INTO ai_interviews (
      id, candidate_id, job_id, model_used, total_questions, status,
      questions_answered, access_token, expires_at, interview_duration_minutes,
      created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      test_candidate_id,
      test_job_id,
      'gpt-4o',
      5,
      'pending',
      0,
      encode(gen_random_bytes(32), 'hex'),
      NOW() + INTERVAL '7 days',
      30,
      NOW(),
      NOW()
    ) RETURNING id INTO test_interview_id;

    RAISE NOTICE 'Test 3.1: Created interview with ID %', test_interview_id;
  ELSE
    RAISE NOTICE 'Test 3.1: No candidate found to create interview';
  END IF;
END $$;


-- ============================================================
-- TEST 4: NOTIFICATIONS TABLE ACCESS
-- ============================================================

-- Test 4.1: Create notification and verify user-specific access
DO $$
DECLARE
  test_notification_id UUID;
BEGIN
  -- Create notification for test recruiter
  INSERT INTO notifications (
    id, user_id, type, title, message, read, created_at
  )
  VALUES (
    gen_random_uuid(),
    'b0000000-0000-0000-0000-000000000001'::UUID,
    'new_application',
    'New Application',
    'You have a new application',
    false,
    NOW()
  ) RETURNING id INTO test_notification_id;

  RAISE NOTICE 'Test 4.1: Created notification with ID %', test_notification_id;
END $$;


-- ============================================================
-- TEST 5: CROSS-ORGANIZATION ACCESS (NEGATIVE TEST)
-- ============================================================

-- Test 5.1: Create user in different org and verify no access
DO $$
DECLARE
  other_org_recruiter_id UUID := 'd0000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Create recruiter in different organization
  INSERT INTO profiles (id, email, full_name, role, organization_id, timezone, notification_preferences, created_at, updated_at)
  VALUES (
    other_org_recruiter_id,
    'test_other_org@example.com',
    'Other Org Recruiter',
    'recruiter',
    'a0000000-0000-0000-0000-000000000002'::UUID,  -- Different org
    'UTC',
    '{}',
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Test 5.1: Created recruiter in different org';
  RAISE NOTICE 'Test 5.1: Verify this user cannot see jobs/candidates from first org (requires auth context)';
END $$;


-- ============================================================
-- TEST 6: ADMIN ACCESS
-- ============================================================

-- Test 6.1: Create admin and verify elevated access
DO $$
DECLARE
  test_admin_id UUID := 'e0000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Create admin user
  INSERT INTO profiles (id, email, full_name, role, organization_id, timezone, notification_preferences, created_at, updated_at)
  VALUES (
    test_admin_id,
    'test_admin@example.com',
    'Test Admin',
    'admin',
    'a0000000-0000-0000-0000-000000000001'::UUID,
    'UTC',
    '{}',
    NOW(),
    NOW()
  ) ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Test 6.1: Created admin user';
  RAISE NOTICE 'Test 6.1: Verify admin can delete jobs, candidates, etc. (requires auth context)';
END $$;


-- ============================================================
-- VERIFICATION QUERIES
-- These can be run to inspect the current state
-- ============================================================

-- List all test users
SELECT id, email, role, organization_id FROM profiles
WHERE email LIKE 'test_%@example.com';

-- List all test jobs
SELECT j.id, j.title, j.status, p.email as created_by_email
FROM jobs j
LEFT JOIN profiles p ON p.id = j.created_by
WHERE p.email LIKE 'test_%@example.com';

-- List RLS policies on each table
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ============================================================
-- CLEANUP (Optional - uncomment to remove test data)
-- ============================================================

/*
DO $$
BEGIN
  DELETE FROM notifications WHERE user_id IN (
    SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
  );
  DELETE FROM candidate_comments WHERE author_id IN (
    SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
  );
  DELETE FROM interview_questions WHERE interview_id IN (
    SELECT ai.id FROM ai_interviews ai
    JOIN jobs j ON j.id = ai.job_id
    JOIN profiles p ON p.id = j.created_by
    WHERE p.email LIKE 'test_%@example.com'
  );
  DELETE FROM ai_interviews WHERE job_id IN (
    SELECT id FROM jobs WHERE created_by IN (
      SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
    )
  );
  DELETE FROM candidate_activity WHERE candidate_id IN (
    SELECT c.id FROM candidates c
    JOIN jobs j ON j.id = c.job_id
    WHERE j.created_by IN (
      SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
    )
  );
  DELETE FROM candidates WHERE job_id IN (
    SELECT id FROM jobs WHERE created_by IN (
      SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
    )
  );
  DELETE FROM pregenerated_questions WHERE job_id IN (
    SELECT id FROM jobs WHERE created_by IN (
      SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
    )
  );
  DELETE FROM jobs WHERE created_by IN (
    SELECT id FROM profiles WHERE email LIKE 'test_%@example.com'
  );
  DELETE FROM profiles WHERE email LIKE 'test_%@example.com';

  RAISE NOTICE 'Test data cleaned up';
END $$;
*/


-- ============================================================
-- INTERACTIVE TESTING GUIDE
-- ============================================================
/*
To fully test RLS policies, you need to simulate different user contexts.
Here's how to test with Supabase:

1. Using Supabase Dashboard:
   - Go to SQL Editor
   - Use the "Role" dropdown to switch between anon, authenticated, service_role
   - For authenticated, you can set the JWT claims

2. Using psql or database client:
   -- Simulate anonymous user
   SET ROLE anon;
   SELECT * FROM jobs; -- Should only see active jobs

   -- Reset role
   RESET ROLE;

3. Using Supabase Client (JavaScript):
   // As anonymous
   const { data: publicJobs } = await supabase
     .from('jobs')
     .select('*');

   // As authenticated user
   await supabase.auth.signInWithPassword({ email, password });
   const { data: myJobs } = await supabase
     .from('jobs')
     .select('*');

4. Key scenarios to test:
   - [ ] Anonymous user can only see published jobs
   - [ ] Candidate can only see their own applications
   - [ ] Candidate cannot see other candidates' data
   - [ ] Recruiter can see all jobs/candidates in their org
   - [ ] Recruiter cannot see other org's data
   - [ ] Admin can delete records in their org
   - [ ] Admin cannot access other org's data
*/
