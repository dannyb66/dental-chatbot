/*
  # Fix Patient Table Policies

  1. Changes
    - Drop all existing policies
    - Create simple, non-recursive policies
    - Focus on basic user-patient relationship first
    
  2. Security
    - Maintain data access control
    - Prevent policy recursion
    - Simplify policy logic
*/

-- First, drop ALL existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their family members' data" ON patients;
DROP POLICY IF EXISTS "Users can manage their family members' data" ON patients;
DROP POLICY IF EXISTS "Users can view their own patient data" ON patients;
DROP POLICY IF EXISTS "Users can insert their own patient data" ON patients;
DROP POLICY IF EXISTS "Users can view own and family data" ON patients;
DROP POLICY IF EXISTS "Users can insert patient data" ON patients;
DROP POLICY IF EXISTS "Users can update own and family data" ON patients;
DROP POLICY IF EXISTS "Users can delete own and family data" ON patients;

-- Create basic policies without family relationships first
CREATE POLICY "patient_select_policy"
  ON patients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "patient_insert_policy"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "patient_update_policy"
  ON patients FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "patient_delete_policy"
  ON patients FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());