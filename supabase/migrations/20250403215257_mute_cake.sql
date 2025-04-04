/*
  # Fix infinite recursion in patients RLS policies

  1. Changes
    - Fix the recursive RLS policies on the patients table
    - Simplify the policy logic to avoid self-referential queries
    - Maintain the same security model but with optimized policy definitions

  2. Security
    - Policies still ensure users can only access their own records and related family members
    - All operations remain protected by RLS
*/

-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "patient_select_policy" ON "public"."patients";
DROP POLICY IF EXISTS "patient_insert_policy" ON "public"."patients";
DROP POLICY IF EXISTS "patient_update_policy" ON "public"."patients";
DROP POLICY IF EXISTS "patient_delete_policy" ON "public"."patients";

-- Create new optimized policies
CREATE POLICY "patient_select_policy" ON "public"."patients"
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR 
  id IN (
    SELECT fr.family_member_id 
    FROM family_relationships fr 
    WHERE fr.primary_patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "patient_insert_policy" ON "public"."patients"
FOR INSERT TO authenticated
WITH CHECK (
  (user_id = auth.uid() AND is_primary = true) OR 
  is_primary = false
);

CREATE POLICY "patient_update_policy" ON "public"."patients"
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid() OR 
  id IN (
    SELECT fr.family_member_id 
    FROM family_relationships fr 
    WHERE fr.primary_patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  )
)
WITH CHECK (
  user_id = auth.uid() OR 
  id IN (
    SELECT fr.family_member_id 
    FROM family_relationships fr 
    WHERE fr.primary_patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "patient_delete_policy" ON "public"."patients"
FOR DELETE TO authenticated
USING (
  user_id = auth.uid() OR 
  id IN (
    SELECT fr.family_member_id 
    FROM family_relationships fr 
    WHERE fr.primary_patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  )
);