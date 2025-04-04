/*
  # Fix RLS Policies for Family Relationships

  1. Changes
    - Drop existing policies with safe checks
    - Add policies for family relationships and appointments
    - Update RLS for patients table
    - Add missing RLS policies for family-related operations

  2. Security
    - Maintain existing security model
    - Ensure proper access control for family relationships
    - Add policies for patient management
*/

-- Drop existing policies safely
DO $$ 
BEGIN
  -- Drop all existing policies for family_relationships
  DROP POLICY IF EXISTS "Users can view their family relationships" ON family_relationships;
  DROP POLICY IF EXISTS "Users can manage their family relationships" ON family_relationships;
  DROP POLICY IF EXISTS "Users can view their family relationships v2" ON family_relationships;
  DROP POLICY IF EXISTS "Users can manage their family relationships v2" ON family_relationships;
  
  -- Drop all existing policies for appointments
  DROP POLICY IF EXISTS "Users can view family member appointments" ON appointments;
  DROP POLICY IF EXISTS "Users can view family member appointments v2" ON appointments;
END $$;

-- Update patients table RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Add policies for patients table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'patients' AND policyname = 'Users can manage their own patient records'
  ) THEN
    CREATE POLICY "Users can manage their own patient records"
      ON patients
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Create new policies with unique names
CREATE POLICY "family_relationships_view_policy_v3"
  ON family_relationships
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM patients WHERE id = primary_patient_id
      UNION
      SELECT user_id FROM patients WHERE id = family_member_id
    )
  );

CREATE POLICY "family_relationships_manage_policy_v3"
  ON family_relationships
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM patients WHERE id = primary_patient_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM patients WHERE id = primary_patient_id)
  );

CREATE POLICY "appointments_family_view_policy_v3"
  ON appointments
  FOR SELECT
  TO authenticated
  USING (
    patient_id IN (
      SELECT family_member_id 
      FROM family_relationships 
      WHERE primary_patient_id IN (
        SELECT id FROM patients WHERE user_id = auth.uid()
      )
    )
    OR
    patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  );