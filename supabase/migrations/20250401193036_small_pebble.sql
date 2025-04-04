/*
  # Simplify available slots to use local time
  
  1. Changes
    - Remove timezone column
    - Update slot generation to use local time
    - Regenerate slots for next 30 days
    - All times will be stored in local time (8 AM - 6 PM)
    
  2. Notes
    - No timezone conversions needed
    - Slots are generated in 30-minute intervals
    - Only future slots are created
*/

-- First, remove the timezone column as we won't need it
ALTER TABLE available_slots DROP COLUMN IF EXISTS timezone;

-- Create a function to generate slots for a specific date
CREATE OR REPLACE FUNCTION generate_slots_for_date(target_date date)
RETURNS void AS $$
DECLARE
  slot_time timestamp;
  minutes integer;
BEGIN
  FOR hour IN 8..17 LOOP
    FOR minutes IN (SELECT unnest('{0,30}'::int[])) LOOP
      slot_time := target_date + (hour || ':' || minutes || ':00')::time;
      
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