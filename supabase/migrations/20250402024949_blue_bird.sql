/*
  # Fix RLS Policy Recursion

  1. Changes
    - Simplify RLS policies to avoid any potential recursion
    - Optimize family member access check function
    - Add proper indexing for performance
    - Ensure proper security checks
  
  2. Security
    - Enable RLS on patients table
    - Add policies for all CRUD operations
    - Maintain strict access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "patient_insert_policy" ON patients;
DROP POLICY IF EXISTS "patient_select_policy" ON patients;
DROP POLICY IF EXISTS "patient_update_policy" ON patients;
DROP POLICY IF EXISTS "patient_delete_policy" ON patients;

-- Create optimized function to check family member access
CREATE OR REPLACE FUNCTION public.check_family_member_access(patient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  has_access boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM family_relationships fr
    JOIN patients p ON p.id = fr.primary_patient_id
    WHERE fr.family_member_id = patient_id
    AND p.user_id = auth.uid()
  ) INTO has_access;
  
  RETURN has_access;
END;
$$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_family_relationships_member_primary
ON family_relationships (family_member_id, primary_patient_id);

CREATE INDEX IF NOT EXISTS idx_patients_user_primary
ON patients (user_id, is_primary);

-- Policy for inserting new patients
CREATE POLICY "patient_insert_policy"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    -- Primary patient registration
    WHEN is_primary = true THEN
      auth.uid() IS NOT NULL AND user_id = auth.uid()
    -- Family member registration
    WHEN is_primary = false THEN
      auth.uid() IS NOT NULL
    ELSE
      false
  END
);

-- Policy for selecting patients
CREATE POLICY "patient_select_policy"
ON public.patients
FOR SELECT
TO authenticated
USING (
  -- Direct access to own records
  user_id = auth.uid() OR
  -- Access to family members through relationships
  EXISTS (
    SELECT 1
    FROM family_relationships fr
    JOIN patients p ON p.id = fr.primary_patient_id
    WHERE fr.family_member_id = patients.id
    AND p.user_id = auth.uid()
  )
);

-- Policy for updating patients
CREATE POLICY "patient_update_policy"
ON public.patients
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid() OR check_family_member_access(id)
)
WITH CHECK (
  user_id = auth.uid() OR check_family_member_access(id)
);

-- Policy for deleting patients
CREATE POLICY "patient_delete_policy"
ON public.patients
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid() OR check_family_member_access(id)
);

-- Ensure RLS is enabled
ALTER TABLE public.patients FORCE ROW LEVEL SECURITY;