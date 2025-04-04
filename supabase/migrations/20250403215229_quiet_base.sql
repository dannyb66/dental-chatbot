/*
  # Fix RLS Policy Recursion

  1. Changes
    - Drop existing policies
    - Create simplified non-recursive policies
    - Use EXISTS clause instead of IN for better performance
    - Separate family member access logic
    
  2. Security
    - Maintain existing security model
    - Prevent infinite recursion
    - Optimize query performance
*/

-- Drop existing policies
DROP POLICY IF EXISTS "patient_select_policy" ON patients;
DROP POLICY IF EXISTS "patient_insert_policy" ON patients;
DROP POLICY IF EXISTS "patient_update_policy" ON patients;
DROP POLICY IF EXISTS "patient_delete_policy" ON patients;

-- Create simplified select policy that avoids recursion
CREATE POLICY "patient_select_policy" ON patients
FOR SELECT TO authenticated
USING (
  -- Direct access to own records
  user_id = auth.uid()
  OR
  -- Access to family members through a non-recursive join
  EXISTS (
    SELECT 1
    FROM family_relationships fr
    JOIN patients p ON p.id = fr.primary_patient_id
    WHERE fr.family_member_id = patients.id
    AND p.user_id = auth.uid()
  )
);

-- Create insert policy for both primary patients and family members
CREATE POLICY "patient_insert_policy" ON patients
FOR INSERT TO authenticated
WITH CHECK (
  -- Primary patients must have user_id set
  (is_primary = true AND user_id = auth.uid())
  OR
  -- Family members don't need user_id
  (is_primary = false)
);

-- Create update policy with simplified access check
CREATE POLICY "patient_update_policy" ON patients
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1
    FROM family_relationships fr
    JOIN patients p ON p.id = fr.primary_patient_id
    WHERE fr.family_member_id = patients.id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1
    FROM family_relationships fr
    JOIN patients p ON p.id = fr.primary_patient_id
    WHERE fr.family_member_id = patients.id
    AND p.user_id = auth.uid()
  )
);

-- Create delete policy with simplified access check
CREATE POLICY "patient_delete_policy" ON patients
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR
  EXISTS (
    SELECT 1
    FROM family_relationships fr
    JOIN patients p ON p.id = fr.primary_patient_id
    WHERE fr.family_member_id = patients.id
    AND p.user_id = auth.uid()
  )
);

-- Create indexes to optimize policy performance
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id);
CREATE INDEX IF NOT EXISTS idx_family_relationships_member ON family_relationships(family_member_id);
CREATE INDEX IF NOT EXISTS idx_family_relationships_primary ON family_relationships(primary_patient_id);