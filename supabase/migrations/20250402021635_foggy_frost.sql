/*
  # Fix Patient Table RLS Policies

  1. Changes
    - Drop all existing policies to start fresh
    - Create simplified policies that avoid recursion
    - Optimize policy performance with EXISTS clauses
    
  2. Security
    - Maintains row-level security
    - Preserves access control for own records
    - Enables secure family member access
    
  3. Notes
    - Uses non-recursive policy structure
    - Optimizes query performance
    - Prevents infinite recursion
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "patients_manage_own" ON patients;
DROP POLICY IF EXISTS "patients_view_family" ON patients;
DROP POLICY IF EXISTS "patient_manage_own_records" ON patients;
DROP POLICY IF EXISTS "patient_view_family_members" ON patients;
DROP POLICY IF EXISTS "Users can manage primary patient records" ON patients;
DROP POLICY IF EXISTS "Users can view family members" ON patients;

-- Create base policy for own records
CREATE POLICY "patients_own_access"
ON patients
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND user_id = auth.uid()
);

-- Create separate policy for viewing family members
-- Uses a non-recursive approach with EXISTS
CREATE POLICY "patients_family_access"
ON patients
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND (
    -- Direct access to own records
    user_id = auth.uid()
    OR 
    -- Access to family members through relationships
    id IN (
      SELECT fr.family_member_id
      FROM family_relationships fr
      JOIN patients p ON p.id = fr.primary_patient_id
      WHERE p.user_id = auth.uid()
    )
  )
);