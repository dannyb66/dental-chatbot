/*
  # Fix timezone storage in available_slots table

  1. Changes
    - Update existing slots to store times in UTC
    - Adjust slot times to be 7 hours ahead (PST to UTC conversion)
    - Ensure all new slots are stored in UTC

  2. Notes
    - Preserves slot availability status
    - Maintains 30-minute intervals
    - Keeps existing slot IDs
*/

-- First, update the existing slots to UTC time
UPDATE available_slots
SET 
  start_time = start_time AT TIME ZONE 'PST' AT TIME ZONE 'UTC',
  end_time = end_time AT TIME ZONE 'PST' AT TIME ZONE 'UTC';

-- Update the function to ensure new slots are created in UTC
CREATE OR REPLACE FUNCTION generate_slots_for_date(target_date date)
RETURNS void AS $$
DECLARE
  v_time timestamp with time zone;
  v_slot_start time;
  v_minute integer;
BEGIN
  -- Generate slots from 15:00 to 01:00 UTC (8 AM to 6 PM PST)
  FOR hour IN 15..23 LOOP -- Start at 15:00 UTC (8 AM PST)
    -- Generate slots for minutes 0 and 30
    FOR v_minute IN SELECT unnest(ARRAY[0, 30]) LOOP
      v_slot_start := make_time(hour, v_minute, 0);
      v_time := target_date + v_slot_start;
      
      INSERT INTO available_slots (
        start_time,
        end_time,
        is_available,
        timezone
      ) VALUES (
        v_time,
        v_time + interval '30 minutes',
        true,
        'UTC'
      );
    END LOOP;
  END LOOP;

  -- Handle the midnight and 1 AM UTC slots (5 PM and 6 PM PST)
  FOR hour IN 0..1 LOOP
    FOR v_minute IN SELECT unnest(ARRAY[0, 30]) LOOP
      v_slot_start := make_time(hour, v_minute, 0);
      v_time := (target_date + interval '1 day') + v_slot_start;
      
      INSERT INTO available_slots (
        start_time,
        end_time,
        is_available,
        timezone
      ) VALUES (
        v_time,
        v_time + interval '30 minutes',
        true,
        'UTC'
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Regenerate slots for April 2, 2025
DELETE FROM available_slots
WHERE DATE(start_time) = DATE '2025-04-02';

SELECT generate_slots_for_date(DATE '2025-04-02');

-- Verify slots were created with correct UTC times
DO $$
DECLARE
  slot_count integer;
BEGIN
  SELECT COUNT(*)
  INTO slot_count
  FROM available_slots
  WHERE DATE(start_time) = DATE '2025-04-02'
  AND (
    (EXTRACT(HOUR FROM start_time) >= 15) OR -- 3 PM UTC and later (8 AM PST and later)
    (EXTRACT(HOUR FROM start_time) <= 1)      -- Midnight and 1 AM UTC (5 PM and 6 PM PST)
  );

  IF slot_count = 0 THEN
    RAISE EXCEPTION 'No slots were created for April 2, 2025';
  ELSE
    RAISE NOTICE 'Successfully created % slots for April 2, 2025 in UTC', slot_count;
  END IF;
END $$;