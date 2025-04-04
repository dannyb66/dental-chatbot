/*
  # Update appointment policies and add stored procedures

  1. Changes
    - Add RLS policies for appointments table
    - Add stored procedures for appointment management
    - Add indexes for better query performance

  2. Security
    - Enable RLS on appointments table
    - Add policies for CRUD operations
    - Grant execute permissions to authenticated users
*/

-- Enable RLS on appointments table if not already enabled
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their appointments" ON appointments;
DROP POLICY IF EXISTS "Users can insert appointments" ON appointments;
DROP POLICY IF EXISTS "Users can update their appointments" ON appointments;
DROP POLICY IF EXISTS "Users can delete their appointments" ON appointments;
DROP POLICY IF EXISTS "Service role can manage all appointments" ON appointments;

-- Create comprehensive policies for appointments
CREATE POLICY "Users can view their appointments"
ON appointments
FOR SELECT
TO authenticated
USING (
  patient_id IN (
    SELECT id FROM patients
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert appointments"
ON appointments
FOR INSERT
TO authenticated
WITH CHECK (
  patient_id IN (
    SELECT id FROM patients
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their appointments"
ON appointments
FOR UPDATE
TO authenticated
USING (
  patient_id IN (
    SELECT id FROM patients
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  patient_id IN (
    SELECT id FROM patients
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their appointments"
ON appointments
FOR DELETE
TO authenticated
USING (
  patient_id IN (
    SELECT id FROM patients
    WHERE user_id = auth.uid()
  )
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_appointments_patient_status 
ON appointments (patient_id, status);

CREATE INDEX IF NOT EXISTS idx_appointments_start_time 
ON appointments (start_time);

-- Create or replace function to handle appointment status updates
CREATE OR REPLACE FUNCTION update_appointment_status(
  p_appointment_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE appointments
  SET 
    status = p_status,
    updated_at = now()
  WHERE id = p_appointment_id
  AND patient_id IN (
    SELECT id FROM patients
    WHERE user_id = auth.uid()
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION update_appointment_status(uuid, text) TO authenticated;