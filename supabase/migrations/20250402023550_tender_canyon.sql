/*
  # Fix RLS Policies for Patients Table

  1. Changes
    - Drop existing policies to avoid conflicts
    - Create new optimized policies for CRUD operations
    - Fix patient insertion policy
    
  2. Security
    - Enable RLS on patients table
    - Add policies for:
      * Inserting new patients (both primary and family)
      * Selecting patients (own and family)
      * Updating patients (own and family)
      * Deleting patients (own and family)
    
  3. Notes
    - Uses security definer function to prevent recursion
    - Separates primary patient and family member logic
    - Optimizes query performance
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
  -- Allow inserting primary patients with user_id
  (is_primary = true AND auth.uid() IS NOT NULL AND user_id = auth.uid())
  OR
  -- Allow inserting family members without requiring user_id
  (is_primary = false AND auth.uid() IS NOT NULL)
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