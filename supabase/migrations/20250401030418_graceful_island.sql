/*
  # Enable RLS and add policies for appointments table

  1. Security Changes
    - Enable Row Level Security on appointments table
    - Add policies for authenticated users to manage their appointments
    - Add policy for service role to manage all appointments

  2. Notes
    - Simplified policy creation to avoid timeout issues
    - Each policy ensures users can only access their own appointments
    - Service role has full access for administrative purposes
*/

-- Enable RLS
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert appointments" ON appointments;
DROP POLICY IF EXISTS "Users can view their appointments" ON appointments;
DROP POLICY IF EXISTS "Users can update their appointments" ON appointments;
DROP POLICY IF EXISTS "Users can delete their appointments" ON appointments;
DROP POLICY IF EXISTS "Service role can manage all appointments" ON appointments;

-- Create new policies
CREATE POLICY "Users can insert appointments"
ON appointments
FOR INSERT
TO authenticated
WITH CHECK (
  patient_id IN (
    SELECT id 
    FROM patients 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can view their appointments"
ON appointments
FOR SELECT
TO authenticated
USING (
  patient_id IN (
    SELECT id 
    FROM patients 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their appointments"
ON appointments
FOR UPDATE
TO authenticated
USING (
  patient_id IN (
    SELECT id 
    FROM patients 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  patient_id IN (
    SELECT id 
    FROM patients 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their appointments"
ON appointments
FOR DELETE
TO authenticated
USING (
  patient_id IN (
    SELECT id 
    FROM patients 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage all appointments"
ON appointments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);