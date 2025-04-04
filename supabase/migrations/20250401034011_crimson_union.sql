/*
  # Add slots for March 31, 2025

  1. Changes
    - Add available slots for March 31, 2025
    - Slots will be added from 8 AM to 6 PM in 30-minute intervals
    - All slots will be marked as available by default
    - Times are stored in UTC

  2. Notes
    - March 31, 2025 is a Monday (business day)
    - Slots are created with proper timezone handling
*/

-- Function to generate slots for a specific date with proper timezone handling
CREATE OR REPLACE FUNCTION generate_slots_for_date(target_date date)
RETURNS void AS $$
DECLARE
  v_time timestamp with time zone;
  v_slot_start time;
  v_minute integer;
BEGIN
  -- Generate slots from 8 AM to 6 PM
  FOR hour IN 8..17 LOOP -- 17 = 5 PM, last slot starts at 5:30 PM
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
        v_time AT TIME ZONE 'UTC',
        (v_time + interval '30 minutes') AT TIME ZONE 'UTC',
        true,
        'UTC'
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Remove any existing slots for March 31, 2025
DELETE FROM available_slots
WHERE DATE(start_time AT TIME ZONE 'UTC') = DATE '2025-03-31';

-- Generate new slots for March 31, 2025
SELECT generate_slots_for_date(DATE '2025-03-31');

-- Verify slots were created
DO $$
DECLARE
  slot_count integer;
BEGIN
  SELECT COUNT(*)
  INTO slot_count
  FROM available_slots
  WHERE DATE(start_time AT TIME ZONE 'UTC') = DATE '2025-03-31';

  IF slot_count = 0 THEN
    RAISE EXCEPTION 'No slots were created for March 31, 2025';
  ELSE
    RAISE NOTICE 'Successfully created % slots for March 31, 2025', slot_count;
  END IF;
END $$;