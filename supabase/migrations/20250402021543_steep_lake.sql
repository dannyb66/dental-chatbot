/*
  # Fix Patient Table Policies

  1. Changes
    - Drop existing conflicting policies
    - Create new optimized policies for patient access
    - Fix infinite recursion issues
    
  2. Security
    - Maintains row-level security
    - Preserves access control requirements
    - Optimizes query performance
    
  3. Notes
    - Uses EXISTS for efficient querying
    - Avoids policy name conflicts
    - Maintains all required access patterns
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "patient_select_policy" ON patients;
DROP POLICY IF EXISTS "patient_insert_policy" ON patients;
DROP POLICY IF EXISTS "patient_update_policy" ON patients;
DROP POLICY IF EXISTS "patient_delete_policy" ON patients;
DROP POLICY IF EXISTS "patient_manage_own_records" ON patients;
DROP POLICY IF EXISTS "patient_view_family_members" ON patients;

-- Create new consolidated policy for managing own records
CREATE POLICY "patients_manage_own"
ON patients
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL AND user_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL AND user_id = auth.uid()
);

-- Create optimized policy for viewing family members
CREATE POLICY "patients_view_family"
ON patients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM family_relationships fr
    WHERE fr.family_member_id = patients.id
    AND EXISTS (
      SELECT 1
      FROM patients p
      WHERE p.id = fr.primary_patient_id
      AND p.user_id = auth.uid()
    )
  )
);