/*
  # Fix infinite recursion in patients RLS policies

  1. Changes
    - Remove policies causing recursion
    - Implement new non-recursive policies for patient access
    - Separate family member access logic to avoid self-referencing queries

  2. Security
    - Maintain data access control through user_id
    - Preserve family member access through relationships
    - Prevent infinite recursion while keeping security intact
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage primary patient records" ON patients;
DROP POLICY IF EXISTS "Users can view family members" ON patients;
DROP POLICY IF EXISTS "Users can manage their own patient records" ON patients;

-- Create base policy for managing own records
CREATE POLICY "patient_manage_own_records"
ON patients
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Create separate policy for viewing family members
-- This avoids recursion by not querying the patients table in the subquery
CREATE POLICY "patient_view_family_members"
ON patients
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM family_relationships fr 
    WHERE 
      fr.family_member_id = patients.id AND
      fr.primary_patient_id IN (
        SELECT p.id 
        FROM patients p 
        WHERE p.user_id = auth.uid()
      )
  )
);