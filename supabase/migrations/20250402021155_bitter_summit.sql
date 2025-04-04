/*
  # Fix patients table RLS policies

  1. Changes
    - Remove recursive policy that was causing infinite loops
    - Simplify RLS policy for patients table
    - Add separate policies for primary and family member access

  2. Security
    - Maintain data access control through user_id
    - Allow access to family members through relationships table
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own patient records" ON patients;

-- Create new policies for patients table
CREATE POLICY "Users can manage primary patient records"
ON patients
FOR ALL
TO authenticated
USING (
  user_id = auth.uid()
)
WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "Users can view family members"
ON patients
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT family_member_id 
    FROM family_relationships 
    WHERE primary_patient_id IN (
      SELECT id FROM patients 
      WHERE user_id = auth.uid()
    )
  )
  OR user_id = auth.uid()
);