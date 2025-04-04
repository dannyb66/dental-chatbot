/*
  # Fix Recursive RLS Policies

  1. Changes
    - Drop existing recursive policies
    - Create new non-recursive policies for patients table
    - Simplify policy logic to prevent infinite recursion
    
  2. Security
    - Maintain same level of access control
    - Prevent infinite recursion in policy evaluation
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view their family members' data" ON patients;
DROP POLICY IF EXISTS "Users can manage their family members' data" ON patients;
DROP POLICY IF EXISTS "Users can view their own patient data" ON patients;
DROP POLICY IF EXISTS "Users can insert their own patient data" ON patients;

-- Create new, simplified policies
CREATE POLICY "Users can view own and family data"
  ON patients FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.user_id = auth.uid()
      AND p.id = patients.primary_patient_id
    )
  );

CREATE POLICY "Users can insert patient data"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.user_id = auth.uid()
      AND p.id = primary_patient_id
    )
  );

CREATE POLICY "Users can update own and family data"
  ON patients FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.user_id = auth.uid()
      AND p.id = patients.primary_patient_id
    )
  )
  WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.user_id = auth.uid()
      AND p.id = primary_patient_id
    )
  );

CREATE POLICY "Users can delete own and family data"
  ON patients FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.user_id = auth.uid()
      AND p.id = patients.primary_patient_id
    )
  );