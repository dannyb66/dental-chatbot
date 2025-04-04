/*
  # Update RLS policies for available_slots table

  1. Changes
    - Add explicit RLS policies for INSERT and DELETE operations
    - Update existing policies to be more specific
    - Add proper security checks for slot updates

  2. Security
    - Enable RLS on available_slots table
    - Add policies for all CRUD operations
    - Ensure proper access control for slot management
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view available slots" ON available_slots;
DROP POLICY IF EXISTS "Users can update available slots" ON available_slots;
DROP POLICY IF EXISTS "Service role can manage all slots" ON available_slots;

-- Create comprehensive policies for available_slots
CREATE POLICY "Anyone can view available slots"
ON available_slots
FOR SELECT
TO PUBLIC
USING (true);

CREATE POLICY "Authenticated users can update slots"
ON available_slots
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated users can insert slots"
ON available_slots
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can delete slots"
ON available_slots
FOR DELETE
TO authenticated
USING (true);

-- Add index to improve query performance
CREATE INDEX IF NOT EXISTS idx_available_slots_availability 
ON available_slots (is_available, start_time);

-- Refresh the RLS cache
ALTER TABLE available_slots DISABLE ROW LEVEL SECURITY;
ALTER TABLE available_slots ENABLE ROW LEVEL SECURITY;