/*
  # Family Relationships Schema

  1. New Tables
    - `family_relationships`
      - `id` (uuid, primary key)
      - `primary_patient_id` (uuid, references patients)
      - `family_member_id` (uuid, references patients)
      - `relationship` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes to Existing Tables
    - Add `is_primary` column to patients table
    - Add indexes for performance

  3. Security
    - Enable RLS on family_relationships table
    - Add policies for managing family relationships
*/

-- Add is_primary column to patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false;

-- Create family_relationships table
CREATE TABLE IF NOT EXISTS family_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  family_member_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  relationship text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_family_relationship UNIQUE (primary_patient_id, family_member_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_family_relationships_primary ON family_relationships(primary_patient_id);
CREATE INDEX IF NOT EXISTS idx_family_relationships_member ON family_relationships(family_member_id);
CREATE INDEX IF NOT EXISTS idx_patients_primary ON patients(is_primary);

-- Enable RLS
ALTER TABLE family_relationships ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for family_relationships
CREATE POLICY "family_relationships_insert_policy" ON family_relationships
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients
      WHERE id = primary_patient_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "family_relationships_select_policy" ON family_relationships
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE id = primary_patient_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "family_relationships_update_policy" ON family_relationships
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE id = primary_patient_id
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients
      WHERE id = primary_patient_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "family_relationships_delete_policy" ON family_relationships
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE id = primary_patient_id
      AND user_id = auth.uid()
    )
  );

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_family_relationships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_family_relationships_updated_at
  BEFORE UPDATE ON family_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_family_relationships_updated_at();

-- Add family_group_id to appointments for grouping family appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS family_group_id uuid;