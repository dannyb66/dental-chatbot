/*
  # Fix RLS Policies for Family Member Registration

  1. Changes
    - Drop existing policies
    - Create new policies that properly handle family member registration
    - Add security definer function for checking family access
    - Separate policies for different operations (insert, select, update, delete)

  2. Security
    - Enable RLS on patients table
    - Add policies for authenticated users
    - Ensure proper access control for family members
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "patients_own_access" ON patients;
DROP POLICY IF EXISTS "patients_family_access" ON patients;
DROP POLICY IF EXISTS "patients_manage_own" ON patients;
DROP POLICY IF EXISTS "patients_view_family" ON patients;
DROP POLICY IF EXISTS "patient_manage_own_records" ON patients;
DROP POLICY IF EXISTS "patient_view_family_members" ON patients;
DROP POLICY IF EXISTS "Users can manage primary patient records" ON patients;
DROP POLICY IF EXISTS "Users can view family members" ON patients;
DROP POLICY IF EXISTS "patients_manage_own_records" ON patients;
DROP POLICY IF EXISTS "patients_view_records" ON patients;
DROP POLICY IF EXISTS "patient_select_policy" ON patients;
DROP POLICY IF EXISTS "patient_insert_policy" ON patients;
DROP POLICY IF EXISTS "patient_update_policy" ON patients;
DROP POLICY IF EXISTS "patient_delete_policy" ON patients;

-- Create function to check family member access
CREATE OR REPLACE FUNCTION check_family_member_access(patient_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM family_relationships fr
    JOIN patients p ON p.id = fr.primary_patient_id
    WHERE fr.family_member_id = patient_id
    AND p.user_id = auth.uid()
  );
$$;

-- Policy for inserting new patients
-- This allows both primary patient registration and family member registration
CREATE POLICY "patients_insert_policy"
ON patients
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow inserting primary patients (with user_id)
  (user_id = auth.uid() AND is_primary = true) OR
  -- Allow inserting family members (without user_id)
  (user_id IS NULL AND is_primary = false)
);

-- Policy for selecting patients
CREATE POLICY "patients_select_policy"
ON patients
FOR SELECT
TO authenticated
USING (
  -- Can view own records
  user_id = auth.uid() OR
  -- Can view family members
  check_family_member_access(id)
);

-- Policy for updating patients
CREATE POLICY "patients_update_policy"
ON patients
FOR UPDATE
TO authenticated
USING (
  -- Can update own records
  user_id = auth.uid() OR
  -- Can update family members
  check_family_member_access(id)
)
WITH CHECK (
  -- Can update own records
  user_id = auth.uid() OR
  -- Can update family members
  check_family_member_access(id)
);

-- Policy for deleting patients
CREATE POLICY "patients_delete_policy"
ON patients
FOR DELETE
TO authenticated
USING (
  -- Can delete own records
  user_id = auth.uid() OR
  -- Can delete family members
  check_family_member_access(id)
);