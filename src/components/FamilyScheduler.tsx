import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, UserPlus } from 'lucide-react';
import { Patient, AppointmentType, AvailableSlot, FamilyMember, FamilyAppointment } from '../types';
import {
  getAvailableSlots,
  getAppointmentTypes,
  findConsecutiveSlots,
  bookFamilyAppointments
} from '../lib/appointments';

interface FamilySchedulerProps {
  primaryPatientId: string;
  familyMembers: FamilyMember[];
  onScheduled: (appointmentIds: string[]) => void;
  onCancel: () => void;
  verifiedPatient: Patient & { verified: boolean };
}

export const FamilyScheduler: React.FC<FamilySchedulerProps> = ({
  primaryPatientId,
  familyMembers,
  onScheduled,
  onCancel,
  verifiedPatient
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [validInitialSlots, setValidInitialSlots] = useState<AvailableSlot[]>([]);
  const [selectedInitialSlot, setSelectedInitialSlot] = useState<string>('');
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [appointments, setAppointments] = useState<FamilyAppointment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAppointmentTypes();
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  useEffect(() => {
    if (selectedDate && selectedMembers.length > 0) {
      loadAvailableSlots();
    }
  }, [selectedDate, selectedMembers]);

  const loadAppointmentTypes = async () => {
    try {
      const types = await getAppointmentTypes();
      setAppointmentTypes(types);
      setError(null);
    } catch (error) {
      setError('Failed to load appointment types');
    }
  };

  const loadAvailableSlots = async () => {
    console.log('Loading available slots for date:', selectedDate);
    console.log('Selected members:', selectedMembers);
    setError(null);
    setIsLoading(true);

    try {
      const result = await findConsecutiveSlots(selectedDate, selectedMembers.length);
      console.log('Consecutive slots result:', result);
      
      if (result) {
        console.log('Available slots:', result.slots);
        console.log('Valid initial slots:', result.validInitialSlots);
        
        setAvailableSlots(result.slots);
        setValidInitialSlots(result.validInitialSlots);
        setSelectedInitialSlot('');
        setAppointments([]);
        setError(null);
      } else {
        console.log('No consecutive slots available');
        setAvailableSlots([]);
        setValidInitialSlots([]);
        setSelectedInitialSlot('');
        setAppointments([]);
        setError('No consecutive slots available for the selected date');
      }
    } catch (error) {
      console.error('Error loading available slots:', error);
      setError('Failed to load available slots');
      setAvailableSlots([]);
      setValidInitialSlots([]);
      setSelectedInitialSlot('');
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const date = new Date(e.target.value + "T00:00:00");
    console.log('Date changed to:', date);
    setSelectedDate(date);
    setSelectedInitialSlot('');
    setError(null);
    setAppointments([]);
  };

  const handleInitialSlotChange = (slotId: string) => {
    console.log('Initial slot selected:', slotId);
    setError(null);
    setSelectedInitialSlot(slotId);
    
    if (!slotId) {
      setAppointments([]);
      return;
    }

    // Find the index of the selected slot in the validInitialSlots array
    const selectedSlotIndex = validInitialSlots.findIndex(slot => slot.id === slotId);
    console.log('Selected slot index:', selectedSlotIndex);
    
    if (selectedSlotIndex === -1) {
      console.error('Invalid slot index');
      return;
    }

    // Get the consecutive slots starting from the selected initial slot
    const consecutiveSlots = validInitialSlots.slice(
      selectedSlotIndex, 
      selectedSlotIndex + selectedMembers.length
    );
    console.log('Consecutive slots:', consecutiveSlots);

    if (consecutiveSlots.length !== selectedMembers.length) {
      console.error('Not enough consecutive slots');
      setError('Not enough consecutive slots available for all selected family members');
      setAppointments([]);
      return;
    }

    // Create appointments for each selected member
    const newAppointments = selectedMembers.map((memberId, index) => {
      const member = memberId === primaryPatientId 
        ? { id: primaryPatientId, full_name: verifiedPatient.full_name, relationship: 'self' }
        : familyMembers.find(fm => fm.id === memberId);

      // Skip if member is not found
      if (!member) {
        console.error('Member not found:', memberId);
        setError('Invalid member selection');
        return null;
      }

      const slot = consecutiveSlots[index];
      if (!slot) {
        console.error('Slot not found for index:', index);
        setError('Invalid slot selection');
        return null;
      }

      return {
        patientId: memberId,
        patientName: member.full_name,
        relationship: member.relationship,
        appointmentTypeId: '',
        slotId: slot.id,
        startTime: slot.start_time,
        emergencyDescription: ''
      };
    }).filter((appointment): appointment is FamilyAppointment => appointment !== null);

    console.log('New appointments:', newAppointments);

    // Only set appointments if all members were found
    if (newAppointments.length === selectedMembers.length) {
      setAppointments(newAppointments);
    } else {
      setAppointments([]);
      setError('One or more selected members are invalid');
    }
  };

  const handleMemberToggle = (memberId: string) => {
    console.log('Toggling member:', memberId);
    setSelectedMembers(prev => {
      const newMembers = prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId];
      
      console.log('New selected members:', newMembers);
      
      if (newMembers.length === 0) {
        setAppointments([]);
        setAvailableSlots([]);
        setValidInitialSlots([]);
        setSelectedInitialSlot('');
        setError(null);
      }
      
      return newMembers;
    });
  };

  const handleAppointmentTypeChange = (memberId: string, typeId: string) => {
    console.log('Changing appointment type:', { memberId, typeId });
    setAppointments(prev =>
      prev.map(appt =>
        appt.patientId === memberId
          ? { ...appt, appointmentTypeId: typeId }
          : appt
      )
    );
    setError(null);
  };

  const handleEmergencyDescriptionChange = (memberId: string, description: string) => {
    setAppointments(prev =>
      prev.map(appt =>
        appt.patientId === memberId
          ? { ...appt, emergencyDescription: description }
          : appt
      )
    );
  };

  const handleSchedule = async () => {
    if (appointments.some(appt => !appt.appointmentTypeId)) {
      setError('Please select appointment types for all family members');
      return;
    }

    // Check if any appointment is an emergency and requires a description
    const emergencyAppointments = appointments.filter(appt => {
      const appointmentType = appointmentTypes.find(type => type.id === appt.appointmentTypeId);
      return appointmentType?.name.toLowerCase() === 'emergency';
    });

    if (emergencyAppointments.some(appt => !appt.emergencyDescription)) {
      setError('Please provide emergency descriptions for all emergency appointments');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const bookedAppointments = await bookFamilyAppointments(
        appointments.map(({ patientId, slotId, appointmentTypeId, emergencyDescription }) => ({
          patientId,
          slotId,
          appointmentTypeId,
          emergencyDescription
        }))
      );
      onScheduled(bookedAppointments.map(appt => appt.id));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to schedule appointments');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={formRef} className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Schedule Family Appointments</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Family Members
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              key={primaryPatientId}
              onClick={() => handleMemberToggle(primaryPatientId)}
              className={`flex items-center justify-between p-3 rounded-md border ${
                selectedMembers.includes(primaryPatientId)
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center">
                <UserPlus className="h-5 w-5 mr-2" />
                <div>
                  <p className="font-medium">{verifiedPatient?.full_name || 'Primary Patient'}</p>
                  <p className="text-sm text-gray-500">self</p>
                </div>
              </div>
            </button>
            
            {familyMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => handleMemberToggle(member.id)}
                className={`flex items-center justify-between p-3 rounded-md border ${
                  selectedMembers.includes(member.id)
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <UserPlus className="h-5 w-5 mr-2" />
                  <div>
                    <p className="font-medium">{member.full_name}</p>
                    <p className="text-sm text-gray-500">{member.relationship}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selectedMembers.length > 0 && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Date
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={handleDateChange}
                    className="w-full px-4 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                    min={format(new Date(), 'yyyy-MM-dd')}
                  />
                  <Calendar className="absolute right-3 top-2.5 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Initial Time Slot
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {validInitialSlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => handleInitialSlotChange(slot.id)}
                      className={`flex items-center justify-center px-4 py-2 rounded-md border ${
                        selectedInitialSlot === slot.id
                          ? 'bg-blue-50 border-blue-500 text-blue-700'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <Clock className="h-4 w-4 mr-2" />
                      {format(new Date(slot.start_time), 'h:mm a')}
                    </button>
                  ))}
                  {validInitialSlots.length === 0 && !isLoading && (
                    <p className="col-span-4 text-center text-gray-500 py-4">
                      No available consecutive slots for this date
                    </p>
                  )}
                </div>
              </div>
            </div>

            {appointments.length > 0 && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Appointment Details
                </h3>
                <div className="space-y-4">
                  {appointments.map((appt) => {
                    const selectedType = appointmentTypes.find(type => type.id === appt.appointmentTypeId);
                    const isEmergency = selectedType?.name.toLowerCase() === 'emergency';

                    return (
                      <div
                        key={appt.patientId}
                        className="p-4 border rounded-lg bg-gray-50"
                      >
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-medium">{appt.patientId === primaryPatientId ? verifiedPatient?.full_name || 'Primary Patient' : appt.patientName}</h4>
                          <span className="text-sm text-gray-500">
                            {format(new Date(appt.startTime), 'h:mm a')}
                          </span>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Appointment Type
                          </label>
                          <select
                            value={appt.appointmentTypeId}
                            onChange={(e) => handleAppointmentTypeChange(appt.patientId, e.target.value)}
                            className="w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select type...</option>
                            {appointmentTypes.map((type) => (
                              <option key={type.id} value={type.id}>
                                {type.name} ({type.duration.replace(':', 'h ')}m)
                              </option>
                            ))}
                          </select>
                        </div>

                        {isEmergency && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-red-700 mb-1">
                              Emergency Description *
                            </label>
                            <textarea
                              value={appt.emergencyDescription}
                              onChange={(e) => handleEmergencyDescriptionChange(appt.patientId, e.target.value)}
                              className="w-full px-3 py-2 border border-red-300 rounded-md focus:ring-red-500 focus:border-red-500"
                              rows={3}
                              placeholder="Please describe the emergency in detail..."
                              required
                            />
                            <p className="mt-2 text-sm text-gray-600">
                              This information will be immediately shared with our dental staff.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={isLoading || appointments.length === 0 || appointments.some(appt => !appt.appointmentTypeId)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Scheduling...' : 'Schedule Family Appointments'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};