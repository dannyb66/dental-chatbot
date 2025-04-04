/*
  # Dental Practice Database Schema

  1. New Tables
    - `patients`
      - Basic patient information
      - Authentication linked via Supabase auth
    - `appointments`
      - Appointment scheduling and management
    - `available_slots`
      - Pre-defined available time slots
    - `appointment_types`
      - Different types of appointments
    
  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Appointment Types
CREATE TABLE IF NOT EXISTS appointment_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  duration interval NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Insert default appointment types
INSERT INTO appointment_types (name, duration) VALUES
  ('Cleaning', '1 hour'::interval),
  ('General Checkup', '30 minutes'::interval),
  ('Emergency', '1 hour'::interval);

-- Patients Table
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  full_name text NOT NULL,
  phone_number text NOT NULL,
  date_of_birth date NOT NULL,
  insurance_name text,
  created_at timestamptz DEFAULT now()
);

-- Available Slots
CREATE TABLE IF NOT EXISTS available_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid REFERENCES patients(id),
  appointment_type_id uuid REFERENCES appointment_types(id),
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  emergency_description text,
  status text DEFAULT 'scheduled',
  created_at timestamptz DEFAULT now()
);

-- Generate sample available slots for the next 30 days
DO $$
DECLARE
  curr_date date := CURRENT_DATE;
  curr_time time;
  slot_date date;
  slot_datetime timestamptz;
BEGIN
  FOR day_offset IN 0..30 LOOP
    slot_date := curr_date + (day_offset || ' days')::interval;
    
    -- Skip Sundays
    IF EXTRACT(DOW FROM slot_date) != 0 THEN
      curr_time := '08:00:00'::time;
      
      WHILE curr_time < '18:00:00'::time LOOP
        slot_datetime := (slot_date || ' ' || curr_time)::timestamptz;
        
        INSERT INTO available_slots (start_time, end_time)
        VALUES (
          slot_datetime,
          slot_datetime + '30 minutes'::interval
        );
        
        curr_time := curr_time + '30 minutes'::interval;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- Enable RLS
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE available_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own patient data"
  ON patients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own patient data"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (patient_id IN (
    SELECT id FROM patients WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert appointments"
  ON appointments FOR INSERT
  TO authenticated
  WITH CHECK (patient_id IN (
    SELECT id FROM patients WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can view available slots"
  ON available_slots FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view appointment types"
  ON appointment_types FOR SELECT
  TO authenticated
  USING (true);