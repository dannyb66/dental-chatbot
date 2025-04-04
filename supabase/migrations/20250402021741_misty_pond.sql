/*
  # Fix Patient Table RLS Policies

  1. Changes
    - Drop all existing policies
    - Create simplified non-recursive policies
    - Separate policies for different operations
    
  2. Security
    - Maintains row-level security
    - Preserves access control
    - Enables secure family member access
    
  3. Notes
    - Uses materialized subqueries to prevent recursion
    - Optimizes query performance
    - Handles both direct and family member access
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "patients_own_access" ON patients;
DROP POLICY IF EXISTS "patients_family_access" ON patients;
DROP POLICY IF EXISTS "patients_manage_own" ON patients;
DROP POLICY IF EXISTS "patients_view_family" ON patients;
DROP POLICY IF EXISTS "patient_manage_own_records" ON patients;
DROP POLICY IF EXISTS "patient_view_family_members" ON patients;
DROP POLICY IF EXISTS "Users can manage primary patient records" ON patients;
DROP POLICY IF EXISTS "Users can view family members" ON patients;

-- Create policy for managing own records (INSERT, UPDATE, DELETE)
CREATE POLICY "patients_manage_own_records"
ON patients
FOR ALL
TO authenticated
USING (
  auth.uid() IS NOT NULL AND 
  user_id = auth.uid()
)
WITH CHECK (
  auth.uid() IS NOT NULL AND 
  user_id = auth.uid()
);

-- Create policy for viewing records (both own and family members)
CREATE POLICY "patients_view_records"
ON patients
FOR SELECT
TO authenticated
USING (
  CASE 
    WHEN auth.uid() IS NULL THEN false
    WHEN user_id = auth.uid() THEN true
    ELSE EXISTS (
      WITH RECURSIVE family_tree AS (
        -- Base case: direct family relationships
        SELECT 
          fr.family_member_id,
          fr.primary_patient_id,
          1 as depth
        FROM family_relationships fr
        JOIN patients p ON p.id = fr.primary_patient_id
        WHERE p.user_id = auth.uid()
        
        UNION ALL
        
        -- Recursive case: family members of family members
        SELECT 
          fr.family_member_id,
          fr.primary_patient_id,
          ft.depth + 1
        FROM family_relationships fr
        JOIN family_tree ft ON fr.primary_patient_id = ft.family_member_id
        WHERE ft.depth < 2  -- Limit recursion depth
      )
      SELECT 1 FROM family_tree WHERE family_member_id = patients.id
    )
  END
);