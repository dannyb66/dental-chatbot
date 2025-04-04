/*
  # Update slot generation end time

  1. Changes
    - Modify slot generation to end at 1 AM UTC (6 PM PST) instead of 2 AM UTC
    - Update existing slots to remove any slots after 1 AM UTC
    - Regenerate slots for upcoming dates with new time range

  2. Data Migration
    - Remove slots after 1 AM UTC
    - Regenerate future slots with new time range
*/

-- First, remove any existing slots after 1 AM UTC
DELETE FROM available_slots
WHERE EXTRACT(HOUR FROM start_time AT TIME ZONE 'UTC') = 1 
  AND EXTRACT(MINUTE FROM start_time AT TIME ZONE 'UTC') >= 30;

-- Create or replace the slot generation function to work in UTC
CREATE OR REPLACE FUNCTION generate_slots_for_date(target_date date)
RETURNS void AS $$
DECLARE
  slot_time timestamptz;
  current_minutes integer;
BEGIN
  -- Generate slots from 15:00 to 23:59 UTC (8 AM to 4:59 PM PST)
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

  -- Handle the next day's early hour (00:00-01:00 UTC, which is 4-5 PM PST previous day)
  FOR hour IN 0..0 LOOP -- Only go up to hour 0 (midnight)
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

  -- Add the 1 AM slots (but not 1:30 AM)
  slot_time := ((target_date + interval '1 day') + make_time(1, 0, 0)) AT TIME ZONE 'UTC';
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

-- Verify slots were created with correct UTC timestamps
DO $$
DECLARE
  slot_count integer;
  late_slot_count integer;
BEGIN
  SELECT COUNT(*)
  INTO slot_count
  FROM available_slots
  WHERE start_time >= CURRENT_DATE;

  -- Check for any slots after 1:00 UTC
  SELECT COUNT(*)
  INTO late_slot_count
  FROM available_slots
  WHERE EXTRACT(HOUR FROM start_time AT TIME ZONE 'UTC') = 1 
    AND EXTRACT(MINUTE FROM start_time AT TIME ZONE 'UTC') >= 30;

  IF slot_count = 0 THEN
    RAISE EXCEPTION 'No slots were created';
  ELSIF late_slot_count > 0 THEN
    RAISE EXCEPTION 'Found % slots after 1:00 UTC', late_slot_count;
  ELSE
    RAISE NOTICE 'Successfully created % slots in UTC (ending at 1:00 UTC)', slot_count;
  END IF;
END $$;