-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS book_appointment(uuid, uuid, uuid, text);
DROP FUNCTION IF EXISTS reschedule_appointment(uuid, uuid);

-- Create stored procedure for booking appointments
CREATE OR REPLACE FUNCTION book_appointment(
  p_patient_id uuid,
  p_slot_id uuid,
  p_appointment_type_id uuid,
  p_emergency_description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_slot available_slots;
  v_appointment_id uuid;
BEGIN
  -- Lock the slot for update to prevent concurrent bookings
  SELECT *
  INTO v_slot
  FROM available_slots
  WHERE id = p_slot_id
  FOR UPDATE;

  -- Check if slot exists and is available
  IF v_slot IS NULL OR NOT v_slot.is_available THEN
    RAISE EXCEPTION 'Selected time slot is no longer available';
  END IF;

  -- Create the appointment
  INSERT INTO appointments (
    patient_id,
    appointment_type_id,
    start_time,
    end_time,
    emergency_description,
    status
  ) VALUES (
    p_patient_id,
    p_appointment_type_id,
    v_slot.start_time,
    v_slot.end_time,
    p_emergency_description,
    'scheduled'
  )
  RETURNING id INTO v_appointment_id;

  -- Mark the slot as unavailable
  UPDATE available_slots
  SET is_available = false
  WHERE id = p_slot_id;

  -- Return the appointment ID
  RETURN json_build_object('appointment_id', v_appointment_id);
END;
$$;

-- Create stored procedure for rescheduling appointments
CREATE OR REPLACE FUNCTION reschedule_appointment(
  p_appointment_id uuid,
  p_new_slot_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_slot_start timestamptz;
  v_old_slot_end timestamptz;
  v_new_slot available_slots;
BEGIN
  -- Get the current appointment times
  SELECT start_time, end_time
  INTO v_old_slot_start, v_old_slot_end
  FROM appointments
  WHERE id = p_appointment_id;

  -- Lock and check the new slot
  SELECT *
  INTO v_new_slot
  FROM available_slots
  WHERE id = p_new_slot_id
  FOR UPDATE;

  -- Check if new slot exists and is available
  IF v_new_slot IS NULL OR NOT v_new_slot.is_available THEN
    RAISE EXCEPTION 'Selected time slot is no longer available';
  END IF;

  -- Update the appointment with new times
  UPDATE appointments
  SET 
    start_time = v_new_slot.start_time,
    end_time = v_new_slot.end_time,
    status = 'scheduled',
    updated_at = now()
  WHERE id = p_appointment_id;

  -- Mark the new slot as unavailable
  UPDATE available_slots
  SET is_available = false
  WHERE id = p_new_slot_id;

  -- Make the old slot available again
  UPDATE available_slots
  SET is_available = true
  WHERE start_time = v_old_slot_start
  AND end_time = v_old_slot_end;

  -- Return success
  RETURN json_build_object('success', true);
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION book_appointment(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION reschedule_appointment(uuid, uuid) TO authenticated;