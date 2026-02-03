-- ============================================================
-- FIX: Add missing 'candidate' value to user_role enum
-- Run this BEFORE running 20260203_update_user_roles.sql
-- ============================================================

-- Add 'candidate' value if it doesn't exist
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'candidate';

-- Check current enum values
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;
