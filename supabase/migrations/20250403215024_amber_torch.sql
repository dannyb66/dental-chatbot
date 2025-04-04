/*
  # Update patients RLS policies and data

  1. Changes
    - Set is_primary to true for all existing patient records
    - Update RLS policies to allow family member creation
    
  2. Security
    - Enable RLS on patients table
    - Add policies for:
      - Authenticated users can create family members
      - Users can read their own and family members' records
      - Users can update their own and family members' records
*/

-- First, update all existing records to have is_primary = true
UPDATE patients SET is_primary = true WHERE is_primary IS NULL OR is_primary = false;

-- Drop existing policies to recreate them with updated logic
DROP POLICY IF EXISTS "patient_insert_policy" ON patients;
DROP POLICY IF EXISTS "patient_select_policy" ON patients;
DROP POLICY IF EXISTS "patient_update_policy" ON patients;
DROP POLICY IF EXISTS "patient_delete_policy" ON patients;

-- Create new policies that handle both primary patients and family members
CREATE POLICY "patient_insert_policy" ON patients
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Allow insert if:
    -- 1. Record is a primary patient (user_id is set)
    -- 2. Record is a family member (is_primary is false)
    (user_id = auth.uid() AND is_primary = true) OR
    (is_primary = false)
  );

CREATE POLICY "patient_select_policy" ON patients
  FOR SELECT TO authenticated
  USING (
    -- Allow select if:
    -- 1. User owns the record
    -- 2. Record is a family member of a patient owned by the user
    user_id = auth.uid() OR
    id IN (
      SELECT family_member_id 
      FROM family_relationships fr
      JOIN patients p ON p.id = fr.primary_patient_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "patient_update_policy" ON patients
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid() OR
    id IN (
      SELECT family_member_id 
      FROM family_relationships fr
      JOIN patients p ON p.id = fr.primary_patient_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    id IN (
      SELECT family_member_id 
      FROM family_relationships fr
      JOIN patients p ON p.id = fr.primary_patient_id
      WHERE p.user_id = auth.uid()
    )
  );

CREATE POLICY "patient_delete_policy" ON patients
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid() OR
    id IN (
      SELECT family_member_id 
      FROM family_relationships fr
      JOIN patients p ON p.id = fr.primary_patient_id
      WHERE p.user_id = auth.uid()
    )
  );