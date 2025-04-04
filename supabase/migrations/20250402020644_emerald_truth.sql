/*
  # Update Patient and Family Member Schema

  1. Changes
    - Make phone_number and date_of_birth nullable for non-primary patients
    - Add constraints to ensure primary patients have required fields
    - Update RLS policies for family member management

  2. Security
    - Maintain existing RLS policies
    - Add validation triggers for primary patients
*/

-- Make phone_number and date_of_birth nullable
ALTER TABLE patients ALTER COLUMN phone_number DROP NOT NULL;
ALTER TABLE patients ALTER COLUMN date_of_birth DROP NOT NULL;

-- Add constraint for primary patients
ALTER TABLE patients ADD CONSTRAINT primary_patient_required_fields
  CHECK (
    (is_primary = false) OR
    (
      is_primary = true AND
      phone_number IS NOT NULL AND
      date_of_birth IS NOT NULL
    )
  );

-- Create trigger function to validate primary patient data
CREATE OR REPLACE FUNCTION validate_primary_patient()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    IF NEW.phone_number IS NULL OR NEW.date_of_birth IS NULL THEN
      RAISE EXCEPTION 'Primary patients must have phone number and date of birth';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS validate_primary_patient_trigger ON patients;
CREATE TRIGGER validate_primary_patient_trigger
  BEFORE INSERT OR UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION validate_primary_patient();

-- Update existing patients to be primary if they have phone and DOB
UPDATE patients
SET is_primary = true
WHERE phone_number IS NOT NULL
  AND date_of_birth IS NOT NULL
  AND is_primary = false;

-- Add index for primary patient lookup
CREATE INDEX IF NOT EXISTS idx_patients_primary ON patients(is_primary) WHERE is_primary = true;

-- Update RLS policies
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can manage their own patient records" ON patients;
  
  CREATE POLICY "Users can manage their own patient records"
    ON patients
    FOR ALL
    TO authenticated
    USING (
      user_id = auth.uid() OR
      id IN (
        SELECT family_member_id
        FROM family_relationships
        WHERE primary_patient_id IN (
          SELECT id FROM patients WHERE user_id = auth.uid()
        )
      )
    )
    WITH CHECK (
      user_id = auth.uid() OR
      id IN (
        SELECT family_member_id
        FROM family_relationships
        WHERE primary_patient_id IN (
          SELECT id FROM patients WHERE user_id = auth.uid()
        )
      )
    );
END $$;