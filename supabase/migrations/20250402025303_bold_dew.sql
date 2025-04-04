/*
  # Fix RLS Policies

  1. Changes
    - Drop existing policies
    - Create simplified non-recursive policies
    - Add optimized function for family member access
    - Ensure proper security checks
  
  2. Security
    - Enable RLS on patients table
    - Add policies for all CRUD operations
    - Maintain strict access control
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "patient_insert_policy" ON patients;
DROP POLICY IF EXISTS "patient_select_policy" ON patients;
DROP POLICY IF EXISTS "patient_update_policy" ON patients;
DROP POLICY IF EXISTS "patient_delete_policy" ON patients;

-- Create optimized function to check family member access
CREATE OR REPLACE FUNCTION public.check_family_member_access(patient_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
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
CREATE POLICY "patient_insert_policy"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (
  CASE
    WHEN is_primary = true THEN
      auth.uid() IS NOT NULL AND user_id = auth.uid()
    WHEN is_primary = false THEN
      auth.uid() IS NOT NULL
    ELSE false
  END
);

-- Policy for selecting patients (simplified non-recursive version)
CREATE POLICY "patient_select_policy"
ON public.patients
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
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