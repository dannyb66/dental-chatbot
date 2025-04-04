/*
  # Add Family Member Support

  1. Changes
    - Add family_relationship column to patients table
    - Add primary_patient_id column to patients table for family connections
    
  2. Security
    - Update RLS policies to allow access to family member records
*/

ALTER TABLE patients
ADD COLUMN IF NOT EXISTS family_relationship text,
ADD COLUMN IF NOT EXISTS primary_patient_id uuid REFERENCES patients(id);

-- Update RLS policies to include family member access
CREATE POLICY "Users can view their family members' data"
  ON patients FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    primary_patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their family members' data"
  ON patients FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id OR
    primary_patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id OR
    primary_patient_id IN (
      SELECT id FROM patients WHERE user_id = auth.uid()
    )
  );