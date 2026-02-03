-- ============================================================
-- Migration: Update User Roles for RBAC
-- Description: Create user_role enum and update profiles table
--              for role-based access control
-- ============================================================

-- Create the user_role enum type
-- Note: If migrating from existing roles, you may need to update
-- existing profile records before altering the column type
DO $$
BEGIN
  -- Check if the type already exists
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('candidate', 'recruiter', 'hiring_manager', 'admin');
  END IF;
END$$;

-- Add organization_id column if it doesn't exist (for company association)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Update role column to use new enum (if it exists as text)
-- This safely handles the migration from string roles to enum
DO $$
BEGIN
  -- Check current column type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'role' 
    AND data_type = 'text'
  ) THEN
    -- First, update existing values to map to new roles
    UPDATE profiles SET role = 'recruiter' WHERE role = 'member';
    
    -- Alter column to use enum
    ALTER TABLE profiles 
    ALTER COLUMN role TYPE user_role 
    USING role::user_role;
  END IF;
END$$;

-- Set default role to 'candidate' for new users
ALTER TABLE profiles 
ALTER COLUMN role SET DEFAULT 'candidate'::user_role;

-- ============================================================
-- Auto-create profile on user signup
-- ============================================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_role_value user_role;
BEGIN
  -- Get role from metadata, default to 'candidate'
  user_role_value := COALESCE(
    (NEW.raw_user_meta_data->>'role')::user_role,
    'candidate'::user_role
  );

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    user_role_value,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Indexes for performance
-- ============================================================

-- Index on role for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Index on organization_id for company lookups
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON profiles(organization_id);
