/*
  # Family Relationships Schema Update

  1. Changes
    - Drop existing trigger
    - Recreate trigger for updated_at timestamp
    - Add family_group_id to appointments table

  2. Security
    - No changes to existing policies
*/

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_family_relationships_updated_at ON family_relationships;
DROP FUNCTION IF EXISTS update_family_relationships_updated_at();

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_family_relationships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_family_relationships_updated_at
  BEFORE UPDATE ON family_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_family_relationships_updated_at();

-- Add family_group_id to appointments for grouping family appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS family_group_id uuid;