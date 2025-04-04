/*
  # Fix infinite recursion in patients RLS policy
  
  1. Changes
    - Fix the patient_select_policy to prevent infinite recursion
    - Simplify the policy logic to avoid circular dependencies
    
  2. Security
    - Maintains existing security model where users can only see:
      a) Their own patient records (where user_id matches)
      b) Family members connected through family_relationships
    - Policy is rewritten to be more efficient and prevent recursion
*/

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "patient_select_policy" ON "public"."patients";

-- Create new policy with fixed logic that avoids recursion
CREATE POLICY "patient_select_policy" ON "public"."patients"
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR 
    id IN (
      SELECT fr.family_member_id 
      FROM family_relationships fr 
      WHERE fr.primary_patient_id IN (
        SELECT p.id 
        FROM patients p 
        WHERE p.user_id = auth.uid()
      )
    )
  );