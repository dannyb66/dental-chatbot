/*
  # Convert available slots to UTC

  1. Changes
    - Convert all existing slots from local time (PST/PDT) to UTC
    - Update slot generation function to use UTC
    - Remove timezone column if it exists
    - Regenerate slots for upcoming dates

  2. Data Migration
    - Convert existing slots to UTC
    - Clear and regenerate future slots
*/

-- First, ensure we're working with timestamptz
ALTER TABLE available_slots 
ALTER COLUMN start_time TYPE timestamptz USING start_time AT TIME ZONE 'UTC',
ALTER COLUMN end_time TYPE timestamptz USING end_time AT TIME ZONE 'UTC';

-- Remove timezone column if it exists
ALTER TABLE available_slots DROP COLUMN IF EXISTS timezone;

-- Convert existing slots from PST to UTC
UPDATE available_slots
SET 
  start_time = start_time AT TIME ZONE 'America/Los_Angeles' AT TIME ZONE 'UTC',
  end_time = end_time AT TIME ZONE 'America/Los_Angeles' AT TIME ZONE 'UTC'
WHERE start_time >= NOW();

-- Create or replace the slot generation function to work in UTC
CREATE OR REPLACE FUNCTION generate_slots_for_date(target_date date)
RETURNS void AS $$
DECLARE
  slot_time timestamptz;
  current_minutes integer;
BEGIN
  -- Generate slots from 15:00 to 02:00 UTC (8 AM to 7 PM PST)
  FOR hour IN 15..23 LOOP
    current_minutes := 0;
    WHILE current_minutes < 60 LOOP
      -- Create timestamp in UTC
      slot_time := (target_date + make_time(hour, current_minutes, 0)) AT TIME ZONE 'UTC';
      
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

  -- Handle the next day's early hours (00:00-02:00 UTC, which is 4-6 PM PST previous day)
  FOR hour IN 0..1 LOOP
    current_minutes := 0;
    WHILE current_minutes < 60 LOOP
      slot_time := ((target_date + interval '1 day') + make_time(hour, current_minutes, 0)) AT TIME ZONE 'UTC';
      
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

-- Clear future slots and regenerate
DELETE FROM available_slots 
WHERE start_time >= CURRENT_DATE;

-- Generate new slots for the next 30 days
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

-- Verify slots were created with UTC timestamps
DO $$
DECLARE
  slot_count integer;
BEGIN
  SELECT COUNT(*)
  INTO slot_count
  FROM available_slots
  WHERE start_time >= CURRENT_DATE;

  IF slot_count = 0 THEN
    RAISE EXCEPTION 'No slots were created';
  ELSE
    RAISE NOTICE 'Successfully created % slots in UTC', slot_count;
  END IF;
END $$;