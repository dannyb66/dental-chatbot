/*
  # Add RLS policies for available slots

  1. Changes
    - Add RLS policies to allow authenticated users to update available slots
    - Add RLS policy to allow service role to manage all slots
  
  2. Security
    - Enable RLS on available_slots table (if not already enabled)
    - Add policy for authenticated users to update slots
    - Add policy for service role to manage all slots
*/

-- Enable RLS on available_slots table if not already enabled
ALTER TABLE available_slots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view available slots" ON available_slots;
DROP POLICY IF EXISTS "Users can update available slots" ON available_slots;
DROP POLICY IF EXISTS "Service role can manage all slots" ON available_slots;

-- Create policy for viewing available slots
CREATE POLICY "Users can view available slots"
ON available_slots
FOR SELECT
TO authenticated
USING (true);

-- Create policy for updating available slots
CREATE POLICY "Users can update available slots"
ON available_slots
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Create policy for service role to manage all slots
CREATE POLICY "Service role can manage all slots"
ON available_slots
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);