/*
  # Remove Family Features

  1. Changes
    - Drop family-related policies and functions
    - Drop family relationships table
    - Remove family-related columns from patients table
    - Create simplified policies for basic patient management
  
  2. Security
    - Maintain RLS on patients table
    - Add simplified policies for basic patient management
*/

-- Drop appointments policy that depends on family_relationships
DROP POLICY IF EXISTS "appointments_family_view_policy_v3" ON appointments;

-- Drop patients policies that depend on family_relationships
DROP POLICY IF EXISTS "patient_select_policy" ON patients;
DROP POLICY IF EXISTS "patient_insert_policy" ON patients;
DROP POLICY IF EXISTS "patient_update_policy" ON patients;
DROP POLICY IF EXISTS "patient_delete_policy" ON patients;

-- Drop function that depends on family_relationships
DROP FUNCTION IF EXISTS check_family_member_access;

-- Drop family relationships table and related objects
DROP TABLE IF EXISTS family_relationships CASCADE;

-- Remove family-related columns from patients table
ALTER TABLE patients 
DROP COLUMN IF EXISTS family_relationship,
DROP COLUMN IF EXISTS primary_patient_id,
DROP COLUMN IF EXISTS is_primary;

-- Drop family-related indexes
DROP INDEX IF EXISTS idx_family_relationships_member_primary;
DROP INDEX IF EXISTS idx_patients_user_primary;
DROP INDEX IF EXISTS idx_patients_primary;

-- Create simplified policies for patients table
CREATE POLICY "patient_select_policy"
ON public.patients
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "patient_insert_policy"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_update_policy"
ON public.patients
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_delete_policy"
ON public.patients
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Ensure RLS is enabled
ALTER TABLE public.patients FORCE ROW LEVEL SECURITY;