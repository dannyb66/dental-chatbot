/*
  # Fix Patient RLS Policies

  1. Changes
    - Drop existing policies
    - Create simplified non-recursive policies
    - Separate policies for different operations
    
  2. Security
    - Maintains row-level security
    - Preserves access control
    - Enables secure family member access
    
  3. Notes
    - Uses simple direct comparisons to prevent recursion
    - Optimizes query performance
    - Handles both direct and family member access
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

-- Create policy for managing own records
CREATE POLICY "patients_manage_own_records"
ON patients
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL AND 
  user_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  user_id = auth.uid()
);

-- Create policy for viewing records
CREATE POLICY "patients_view_records"
ON patients
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL AND (
    user_id = auth.uid() OR
    check_family_member_access(id)
  )
);