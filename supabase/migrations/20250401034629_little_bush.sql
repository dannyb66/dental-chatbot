-- Function to generate slots for a specific date with proper timezone handling
CREATE OR REPLACE FUNCTION generate_slots_for_date(target_date date)
RETURNS void AS $$
DECLARE
  v_time timestamp with time zone;
  v_slot_start time;
  v_minute integer;
BEGIN
  -- Generate slots from 8 AM to 6 PM UTC
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
        v_time,
        v_time + interval '30 minutes',
        true,
        'UTC'
      );
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Remove any existing slots for April 2, 2025
DELETE FROM available_slots
WHERE DATE(start_time) = DATE '2025-04-02';

-- Generate new slots for April 2, 2025
SELECT generate_slots_for_date(DATE '2025-04-02');

-- Verify slots were created
DO $$
DECLARE
  slot_count integer;
BEGIN
  SELECT COUNT(*)
  INTO slot_count
  FROM available_slots
  WHERE DATE(start_time) = DATE '2025-04-02';

  IF slot_count = 0 THEN
    RAISE EXCEPTION 'No slots were created for April 2, 2025';
  ELSE
    RAISE NOTICE 'Successfully created % slots for April 2, 2025', slot_count;
  END IF;
END $$;