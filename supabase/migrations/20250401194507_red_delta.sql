/*
  # Fix slot generation for dental appointments

  1. Changes
    - Remove timezone column from available_slots table
    - Create function to generate slots for specific dates
    - Generate slots for the next 30 days
    - Skip Sundays
    - Generate slots from 8 AM to 6 PM with 30-minute intervals

  2. Notes
    - All times are stored without timezone
    - Slots are only created for future times
    - Each slot is 30 minutes long
*/

-- First, remove the timezone column as we won't need it
ALTER TABLE available_slots DROP COLUMN IF EXISTS timezone;

-- Create a function to generate slots for a specific date
CREATE OR REPLACE FUNCTION generate_slots_for_date(target_date date)
RETURNS void AS $$
DECLARE
  slot_time timestamp;
  current_minutes integer;
BEGIN
  -- Generate slots from 8 AM to 6 PM (last slot at 5:30 PM)
  FOR hour IN 8..17 LOOP
    current_minutes := 0;
    WHILE current_minutes < 60 LOOP
      slot_time := target_date + make_time(hour, current_minutes, 0);
      
      -- Only create slots for future times
      IF slot_time > NOW() THEN
        INSERT INTO available_slots (
          start_time,
          end_time,
          is_available
        ) VALUES (
          slot_time,
          slot_time + interval '30 minutes',
          true
        );
      END IF;
      
      current_minutes := current_minutes + 30;
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Clear existing slots
TRUNCATE available_slots;

-- Generate slots for the next 30 days
DO $$
DECLARE
  day_counter date;
BEGIN
  day_counter := CURRENT_DATE;
  
  FOR i IN 0..29 LOOP
    -- Skip Sundays (0 = Sunday in EXTRACT(DOW))
    IF EXTRACT(DOW FROM day_counter) != 0 THEN
      PERFORM generate_slots_for_date(day_counter);
    END IF;
    day_counter := day_counter + interval '1 day';
  END LOOP;
END $$;