/*
  # Update available_slots RLS policies

  1. Changes
    - Refine RLS policies for available_slots table
    - Add more specific policies for slot management
    - Add indexes for better performance

  2. Security
    - Enable RLS on available_slots table
    - Add granular policies for different operations
    - Ensure proper access control for slot updates
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view available slots" ON available_slots;
DROP POLICY IF EXISTS "Authenticated users can update slots" ON available_slots;
DROP POLICY IF EXISTS "Authenticated users can insert slots" ON available_slots;
DROP POLICY IF EXISTS "Authenticated users can delete slots" ON available_slots;

-- Create refined policies for available_slots
CREATE POLICY "Anyone can view available slots"
ON available_slots
FOR SELECT
TO PUBLIC
USING (true);

-- Allow authenticated users to update slots
CREATE POLICY "Users can update slot availability"
ON available_slots
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Only allow service role to insert new slots
CREATE POLICY "Service role can insert slots"
ON available_slots
FOR INSERT
TO service_role
WITH CHECK (true);

-- Only allow service role to delete slots
CREATE POLICY "Service role can delete slots"
ON available_slots
FOR DELETE
TO service_role
USING (true);

-- Add composite index for better query performance
CREATE INDEX IF NOT EXISTS idx_available_slots_availability_time 
ON available_slots (is_available, start_time, end_time);

-- Refresh the RLS cache
ALTER TABLE available_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE available_slots ENABLE ROW LEVEL SECURITY;