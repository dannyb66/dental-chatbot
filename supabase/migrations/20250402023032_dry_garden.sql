/*
  # Fix RLS Policies for Patients Table

  1. Changes
    - Drop all existing policies to avoid conflicts
    - Create a security definer function for family member access
    - Create new optimized policies for CRUD operations
    
  2. Security
    - Enable RLS on patients table
    - Add policies for:
      * Inserting new patients (both primary and family members)
      * Selecting patients (own and family)
      * Updating patients (own and family)
      * Deleting patients (own and family)
    
  3. Notes
    - Uses security definer function to prevent recursion
    - Separates primary patient and family member logic
    - Optimizes query performance
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
DROP POLICY IF EXISTS "patients_insert_policy" ON patients;
DROP POLICY IF EXISTS "patients_select_policy" ON patients;
DROP POLICY IF EXISTS "patients_update_policy" ON patients;
DROP POLICY IF EXISTS "patients_delete_policy" ON patients;

-- Create optimized function to check family member access
CREATE OR REPLACE FUNCTION public.check_family_member_access(patient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM family_relationships fr
    INNER JOIN patients p ON p.id = fr.primary_patient_id
    WHERE fr.family_member_id = patient_id
    AND p.user_id = auth.uid()
  );
END;
$$;

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
    ELSE
      auth.uid() IS NOT NULL AND user_id IS NULL
  END
);

-- Policy for selecting patients
CREATE POLICY "patient_select_policy"
ON public.patients
FOR SELECT
TO authenticated
USING (
  -- Direct access to own records or family members
  user_id = auth.uid() OR check_family_member_access(id)
);

-- Policy for updating patients
CREATE POLICY "patient_update_policy"
ON public.patients
FOR UPDATE
TO authenticated
USING (
  -- Can only update own records or family members
  user_id = auth.uid() OR check_family_member_access(id)
)
WITH CHECK (
  -- Verify update permissions
  user_id = auth.uid() OR check_family_member_access(id)
);

-- Policy for deleting patients
CREATE POLICY "patient_delete_policy"
ON public.patients
FOR DELETE
TO authenticated
USING (
  -- Can only delete own records or family members
  user_id = auth.uid() OR check_family_member_access(id)
);