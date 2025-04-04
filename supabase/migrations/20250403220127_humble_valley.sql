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
  -- Allow inserting patients with the authenticated user's ID
  user_id = auth.uid()
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