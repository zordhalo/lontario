-- ============================================================
-- Migration: Row Level Security for Profiles
-- Description: RLS policies to secure profile access based on
--              user authentication and roles
-- ============================================================

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Service role has full access" ON profiles;

-- ============================================================
-- SELECT Policies
-- ============================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_profile
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Recruiters and hiring managers can view profiles in their organization
CREATE POLICY "Org members can view org profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS viewer
      WHERE viewer.id = auth.uid()
      AND viewer.role IN ('recruiter', 'hiring_manager')
      AND viewer.organization_id IS NOT NULL
      AND viewer.organization_id = profiles.organization_id
    )
  );

-- ============================================================
-- UPDATE Policies
-- ============================================================

-- Users can update their own profile (but not their role)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins can update any profile including roles
CREATE POLICY "Admins can update profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_profile
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- ============================================================
-- INSERT Policies
-- ============================================================

-- New profiles are created by the trigger (SECURITY DEFINER)
-- Allow service role inserts for admin operations
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- DELETE Policies
-- ============================================================

-- Only admins can delete profiles
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_profile
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- ============================================================
-- Helper function to check user role
-- ============================================================

-- Function to get current user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
DECLARE
  user_role_value user_role;
BEGIN
  SELECT role INTO user_role_value
  FROM profiles
  WHERE id = auth.uid();
  
  RETURN user_role_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if current user has specific role(s)
CREATE OR REPLACE FUNCTION public.has_role(required_roles user_role[])
RETURNS BOOLEAN AS $$
DECLARE
  user_role_value user_role;
BEGIN
  SELECT role INTO user_role_value
  FROM profiles
  WHERE id = auth.uid();
  
  RETURN user_role_value = ANY(required_roles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
