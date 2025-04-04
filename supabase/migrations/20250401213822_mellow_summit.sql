/*
  # Add unique constraint for patient identification

  1. Changes
    - Add unique constraint on phone_number and date_of_birth columns
    - This prevents duplicate patient registrations with the same phone and DOB

  2. Security
    - No changes to RLS policies
    - Maintains existing security model

  Note: This change ensures each phone number + DOB combination can only exist once,
  preventing duplicate patient registrations while still allowing family members
  to share phone numbers as long as they have different DOBs.
*/

-- Add unique constraint to prevent duplicate registrations
ALTER TABLE patients 
ADD CONSTRAINT patients_phone_dob_unique 
UNIQUE (phone_number, date_of_birth);

-- Add an index to improve lookup performance
CREATE INDEX idx_patients_phone_dob 
ON patients (phone_number, date_of_birth);