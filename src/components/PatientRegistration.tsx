import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Patient } from '../types';

interface PatientRegistrationProps {
  userId: string;
  onComplete: (patient: Patient) => void;
  onCancel: () => void;
}

interface ValidationErrors {
  phoneNumber?: string;
  dateOfBirth?: string;
}

export const PatientRegistration: React.FC<PatientRegistrationProps> = ({
  userId,
  onComplete,
  onCancel,
}) => {
  const [formData, setFormData] = useState({
    fullName: '',
    phoneNumber: '',
    dateOfBirth: '',
    insuranceName: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to the form when it mounts
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  const validatePhoneNumber = (phone: string): boolean => {
    // Accept formats: (123) 456-7890, 123-456-7890, 1234567890
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10;
  };

  const validateDateOfBirth = (dob: string): boolean => {
    if (!dob) return false;
    
    const dobDate = new Date(dob);
    const today = new Date();
    
    // Check if it's a valid date
    if (isNaN(dobDate.getTime())) return false;
    
    // Check if date is not in the future
    if (dobDate > today) return false;
    
    // Check if person is not over 120 years old
    const maxAge = new Date();
    maxAge.setFullYear(today.getFullYear() - 120);
    if (dobDate < maxAge) return false;
    
    return true;
  };

  const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 0) return '';
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhone = formatPhoneNumber(e.target.value);
    setFormData(prev => ({ ...prev, phoneNumber: formattedPhone }));
    
    if (formattedPhone && !validatePhoneNumber(formattedPhone)) {
      setValidationErrors(prev => ({
        ...prev,
        phoneNumber: 'Please enter a valid 10-digit phone number'
      }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.phoneNumber;
        return newErrors;
      });
    }
  };

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = e.target.value;
    setFormData(prev => ({ ...prev, dateOfBirth: date }));
    
    if (date && !validateDateOfBirth(date)) {
      setValidationErrors(prev => ({
        ...prev,
        dateOfBirth: 'Please enter a valid date of birth'
      }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.dateOfBirth;
        return newErrors;
      });
    }

    // Check for duplicate if both phone and DOB are valid
    if (validatePhoneNumber(formData.phoneNumber) && validateDateOfBirth(date)) {
      const isDuplicate = await checkForDuplicatePatient(formData.phoneNumber, date);
      if (isDuplicate) {
        setError('A patient with this phone number and date of birth already exists. If this is you, please use the verification process instead.');
      } else {
        setError(null);
      }
    }
  };

  const checkForDuplicatePatient = async (phoneNumber: string, dateOfBirth: string): Promise<boolean> => {
    setIsCheckingDuplicate(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('phone_number', phoneNumber)
        .eq('date_of_birth', dateOfBirth)
        .limit(1);

      if (error) throw error;
      return data && data.length > 0;
    } catch (err) {
      console.error('Error checking for duplicate patient:', err);
      return false;
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!formData.fullName.trim()) {
      setError('Please enter your full name');
      return;
    }

    if (!formData.phoneNumber || !validatePhoneNumber(formData.phoneNumber)) {
      setValidationErrors(prev => ({
        ...prev,
        phoneNumber: 'Please enter a valid phone number'
      }));
      return;
    }

    if (!formData.dateOfBirth || !validateDateOfBirth(formData.dateOfBirth)) {
      setValidationErrors(prev => ({
        ...prev,
        dateOfBirth: 'Please enter a valid date of birth'
      }));
      return;
    }

    setIsLoading(true);

    try {
      // Check for duplicate patient one last time before submitting
      const isDuplicate = await checkForDuplicatePatient(formData.phoneNumber, formData.dateOfBirth);
      if (isDuplicate) {
        setError('A patient with this phone number and date of birth already exists. If this is you, please use the verification process instead.');
        setIsLoading(false);
        return;
      }

      const { data, error: registrationError } = await supabase
        .from('patients')
        .insert([
          {
            user_id: userId,
            full_name: formData.fullName.trim(),
            phone_number: formData.phoneNumber,
            date_of_birth: formData.dateOfBirth,
            insurance_name: formData.insuranceName.trim() || null,
          },
        ])
        .select()
        .single();

      if (registrationError) {
        if (registrationError.code === '23505') { // Unique constraint violation
          setError('A patient with this phone number and date of birth already exists. If this is you, please use the verification process instead.');
        } else {
          throw registrationError;
        }
      } else if (data) {
        onComplete(data);
      }
    } catch (err) {
      setError('Failed to register patient information. Please try again.');
      console.error('Registration error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={formRef} className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Patient Registration</h2>
        <button
          onClick={onCancel}
          className="p-2 hover:bg-gray-100 rounded-full"
          title="Close registration form"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full Name *
          </label>
          <input
            type="text"
            required
            value={formData.fullName}
            onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            className="w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Enter your full name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number *
          </label>
          <input
            type="tel"
            required
            value={formData.phoneNumber}
            onChange={handlePhoneChange}
            className={`w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.phoneNumber ? 'border-red-500' : ''
            }`}
            placeholder="(123) 456-7890"
          />
          {validationErrors.phoneNumber && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.phoneNumber}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Date of Birth *
          </label>
          <input
            type="date"
            required
            value={formData.dateOfBirth}
            onChange={handleDateChange}
            max={new Date().toISOString().split('T')[0]}
            className={`w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
              validationErrors.dateOfBirth ? 'border-red-500' : ''
            }`}
          />
          {validationErrors.dateOfBirth && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.dateOfBirth}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Insurance Name
          </label>
          <input
            type="text"
            value={formData.insuranceName}
            onChange={(e) => setFormData(prev => ({ ...prev, insuranceName: e.target.value }))}
            className="w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="Optional - Leave blank if self-pay"
          />
        </div>

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
            disabled={isLoading || isCheckingDuplicate || Object.keys(validationErrors).length > 0}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Registering...' : isCheckingDuplicate ? 'Checking...' : 'Complete Registration'}
          </button>
        </div>
      </form>
    </div>
  );
};