/*
  # Update available slots generation functions

  1. Changes
    - Add function to check if a date is a Sunday
    - Add function to generate available slots
    - Generate slots for business hours (8 AM to 6 PM)
    - Only generate slots for Monday through Saturday
    - Set 30-minute intervals for appointments

  2. Notes
    - Business hours: 8 AM to 6 PM
    - Operating days: Monday through Saturday
    - Slot duration: 30 minutes
*/

-- Function to check if a date is a Sunday
CREATE OR REPLACE FUNCTION is_sunday(check_date date) 
RETURNS boolean AS $$
BEGIN
  RETURN EXTRACT(DOW FROM check_date) = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to generate available slots
CREATE OR REPLACE FUNCTION generate_available_slots(p_start_date date, p_num_days integer)
RETURNS void AS $$
DECLARE
  v_date date;
  v_time timestamp with time zone;
  v_slot_start time;
  v_minute integer;
BEGIN
  -- Clear existing future slots
  DELETE FROM available_slots 
  WHERE start_time >= p_start_date;

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
          v_time := v_date + v_slot_start;
          
          -- Only insert if the slot is in the future
          IF v_time > NOW() THEN
            INSERT INTO available_slots (
              start_time,
              end_time,
              is_available
            ) VALUES (
              v_time,
              v_time + interval '30 minutes',
              true
            );
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;