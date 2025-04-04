/*
  # Family Management Schema Update

  1. New Tables
    - `family_relationships`
      - Tracks relationships between primary patients and family members
      - Includes relationship type and timestamps
      - Enforces unique combinations of primary and family member patients

  2. Schema Changes
    - Added `family_group_id` to appointments for grouping family appointments
    - Added `is_primary` flag to patients table
    - Added index for family group lookups

  3. Security
    - Enabled RLS on family_relationships table
    - Added policies for viewing and managing family relationships
    - Updated appointment policies to allow family member access

  4. Functions
    - Added `find_consecutive_slots` function for family booking
    - Helps find available consecutive time slots for family appointments
*/

-- Create family_relationships table if it doesn't exist
CREATE TABLE IF NOT EXISTS family_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_patient_id uuid REFERENCES patients(id) NOT NULL,
  family_member_id uuid REFERENCES patients(id) NOT NULL,
  relationship text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(primary_patient_id, family_member_id)
);

-- Add family_group_id to appointments if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'appointments' 
    AND column_name = 'family_group_id'
  ) THEN
    ALTER TABLE appointments ADD COLUMN family_group_id uuid;
  END IF;
END $$;

-- Create index for family group if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_appointments_family_group ON appointments(family_group_id);

-- Add is_primary to patients if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patients' 
    AND column_name = 'is_primary'
  ) THEN
    ALTER TABLE patients ADD COLUMN is_primary boolean DEFAULT false;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE family_relationships ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and create new ones
DO $$ 
BEGIN
  -- Drop existing policies
  DROP POLICY IF EXISTS "Users can view their family relationships" ON family_relationships;
  DROP POLICY IF EXISTS "Users can manage their family relationships" ON family_relationships;
  DROP POLICY IF EXISTS "Users can view family member appointments" ON appointments;

  -- Create new policies
  CREATE POLICY "Users can view their family relationships v2"
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

  CREATE POLICY "Users can manage their family relationships v2"
    ON family_relationships
    FOR ALL
    TO authenticated
    USING (
      auth.uid() = (SELECT user_id FROM patients WHERE id = primary_patient_id)
    )
    WITH CHECK (
      auth.uid() = (SELECT user_id FROM patients WHERE id = primary_patient_id)
    );

  CREATE POLICY "Users can view family member appointments v2"
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
END $$;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS find_consecutive_slots(timestamptz, timestamptz, integer);

-- Create or replace function for finding consecutive slots
CREATE OR REPLACE FUNCTION find_consecutive_slots(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_num_slots integer
)
RETURNS TABLE (
  slot_ids uuid[],
  start_times timestamptz[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE consecutive_slots AS (
    -- Base case: Find first available slot
    SELECT 
      ARRAY[id] as slot_ids,
      ARRAY[start_time] as start_times,
      end_time,
      1 as slot_count
    FROM available_slots
    WHERE start_time >= p_start_date
      AND start_time <= p_end_date
      AND is_available = true
    
    UNION ALL
    
    -- Recursive case: Find next consecutive slot
    SELECT 
      cs.slot_ids || s.id,
      cs.start_times || s.start_time,
      s.end_time,
      cs.slot_count + 1
    FROM consecutive_slots cs
    JOIN available_slots s ON s.start_time = cs.end_time
    WHERE s.is_available = true
      AND cs.slot_count < p_num_slots
  )
  SELECT slot_ids, start_times
  FROM consecutive_slots
  WHERE slot_count = p_num_slots
  ORDER BY start_times[1]
  LIMIT 1;
END;
$$;