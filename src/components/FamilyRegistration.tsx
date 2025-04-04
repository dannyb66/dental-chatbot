import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { addFamilyMember } from '../lib/appointments';
import { Patient, FamilyMember } from '../types';
import { supabase } from '../lib/supabase';

interface FamilyRegistrationProps {
  primaryPatientId: string;
  onComplete: (members: FamilyMember[]) => void;
  onCancel: () => void;
}

interface FamilyMemberForm {
  fullName: string;
  relationship: string;
}

export const FamilyRegistration: React.FC<FamilyRegistrationProps> = ({
  primaryPatientId,
  onComplete,
  onCancel,
}) => {
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberForm[]>([
    { fullName: '', relationship: '' }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  const addMemberForm = () => {
    setFamilyMembers([...familyMembers, { fullName: '', relationship: '' }]);
  };

  const removeMemberForm = (index: number) => {
    setFamilyMembers(familyMembers.filter((_, i) => i !== index));
  };

  const updateMemberForm = (index: number, field: keyof FamilyMemberForm, value: string) => {
    const updatedMembers = [...familyMembers];
    updatedMembers[index] = { ...updatedMembers[index], [field]: value };
    setFamilyMembers(updatedMembers);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate forms
    const invalidForms = familyMembers.filter(
      member => !member.fullName.trim() || !member.relationship.trim()
    );

    if (invalidForms.length > 0) {
      setError('Please fill in all required fields for each family member');
      return;
    }

    setIsLoading(true);

    try {
      const addedMembers: FamilyMember[] = [];

      // Get the primary patient's user_id
      const { data: primaryPatient, error: primaryError } = await supabase
        .from('patients')
        .select('user_id')
        .eq('id', primaryPatientId)
        .single();

      if (primaryError || !primaryPatient?.user_id) {
        throw new Error('Failed to get primary patient information');
      }

      for (const member of familyMembers) {
        const familyMember = await addFamilyMember(
          primaryPatientId,
          {
            fullName: member.fullName.trim(),
            relationship: member.relationship.trim(),
            userId: primaryPatient.user_id
          }
        );
        addedMembers.push(familyMember);
      }

      onComplete(addedMembers);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to add family members');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={formRef} className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Add Family Members</h2>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-full"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {familyMembers.map((member, index) => (
          <div key={index} className="p-4 border rounded-lg bg-gray-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Family Member {index + 1}</h3>
              {familyMembers.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMemberForm(index)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded-full"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={member.fullName}
                  onChange={(e) => updateMemberForm(index, 'fullName', e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter family member's full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship *
                </label>
                <select
                  required
                  value={member.relationship}
                  onChange={(e) => updateMemberForm(index, 'relationship', e.target.value)}
                  className="w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select relationship...</option>
                  <option value="spouse">Spouse</option>
                  <option value="child">Child</option>
                  <option value="parent">Parent</option>
                  <option value="sibling">Sibling</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addMemberForm}
          className="w-full px-4 py-2 text-blue-500 border border-blue-500 rounded-md hover:bg-blue-50 flex items-center justify-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Another Family Member
        </button>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Adding Family Members...' : 'Add Family Members'}
          </button>
        </div>
      </form>
    </div>
  );
};