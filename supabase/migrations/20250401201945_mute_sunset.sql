/*
  # Add updated_at columns with automatic updates

  1. Changes
    - Add updated_at column to all tables
    - Create trigger function to automatically update the column
    - Add triggers to all tables
    
  2. Tables Modified
    - available_slots
    - appointment_types
    - patients
    - appointments

  3. Triggers
    - Each table gets a trigger to automatically update updated_at on row updates
*/

-- Create the trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at column to available_slots
ALTER TABLE available_slots
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger for available_slots
DROP TRIGGER IF EXISTS update_available_slots_updated_at ON available_slots;
CREATE TRIGGER update_available_slots_updated_at
    BEFORE UPDATE ON available_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at column to appointment_types
ALTER TABLE appointment_types
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger for appointment_types
DROP TRIGGER IF EXISTS update_appointment_types_updated_at ON appointment_types;
CREATE TRIGGER update_appointment_types_updated_at
    BEFORE UPDATE ON appointment_types
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at column to patients
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger for patients
DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
CREATE TRIGGER update_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at column to appointments
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger for appointments
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
CREATE TRIGGER update_appointments_updated_at
    BEFORE UPDATE ON appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();