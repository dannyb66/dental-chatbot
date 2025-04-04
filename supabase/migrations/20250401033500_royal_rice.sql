/*
  # Update available slots with timezone handling

  1. Changes
    - Drop existing slots to regenerate with proper timezone handling
    - Add timezone column to available_slots table
    - Update generate_available_slots function to handle timezones
    - Generate new slots for the next 30 days

  2. Security
    - Maintain existing RLS policies
*/

-- Add timezone column to available_slots
ALTER TABLE available_slots 
ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC';

-- Drop existing slots to regenerate
DELETE FROM available_slots;

-- Update the generate_available_slots function to handle timezones
CREATE OR REPLACE FUNCTION generate_available_slots(p_start_date date, p_num_days integer)
RETURNS void AS $$
DECLARE
  v_date date;
  v_time timestamp with time zone;
  v_slot_start time;
  v_minute integer;
BEGIN
  -- Generate slots for each day
  FOR i IN 0..p_num_days-1 LOOP
    v_date := p_start_date + i * interval '1 day';
    
    -- Skip Sundays
    IF NOT is_sunday(v_date) THEN
      -- Generate slots from 8 AM to 6 PM
      FOR hour IN 8..17 LOOP -- 17 = 5 PM, last slot starts at 5:30 PM
        -- Generate slots for minutes 0 and 30
        FOR v_minute IN SELECT unnest(ARRAY[0, 30]) LOOP
          v_slot_start := make_time(hour, v_minute, 0);
          v_time := v_date + v_slot_start AT TIME ZONE 'UTC';
          
          -- Only insert if the slot is in the future
          IF v_time > NOW() THEN
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
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Generate slots for the next 30 days
SELECT generate_available_slots(CURRENT_DATE, 30);