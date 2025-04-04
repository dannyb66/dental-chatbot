import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';
import { AvailableSlot, AppointmentType } from '../types';
import { getAvailableSlots, getAppointmentTypes, bookAppointment } from '../lib/appointments';

interface AppointmentSchedulerProps {
  patientId: string;
  onScheduled: (appointmentId: string) => void;
  onCancel: () => void;
  familyMembers: any[];
}

export const AppointmentScheduler: React.FC<AppointmentSchedulerProps> = ({
  patientId,
  onScheduled,
  onCancel,
  familyMembers
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  });
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [emergencyDescription, setEmergencyDescription] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAppointmentTypes();
    // Scroll to form when it mounts
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate]);

  const loadAppointmentTypes = async () => {
    try {
      const types = await getAppointmentTypes();
      setAppointmentTypes(types);
    } catch (error) {
      setError('Failed to load appointment types');
    }
  };

  const loadAvailableSlots = async () => {
    try {
      const slots = await getAvailableSlots(selectedDate);
      setAvailableSlots(slots);
    } catch (error) {
      setError('Failed to load available slots');
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDateValue = e.target.value;
    const date = new Date(selectedDateValue + "T00:00:00");
    setSelectedDate(date);
  };

  const handleSchedule = async () => {
    if (!selectedSlot || !selectedType) {
      setError('Please select both a time slot and appointment type');
      return;
    }

    if (isEmergencyAppointment && !emergencyDescription.trim()) {
      setError('Please provide a description of your emergency');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const appointment = await bookAppointment(
        patientId,
        selectedSlot,
        selectedType,
        isEmergencyAppointment ? emergencyDescription.trim() : undefined
      );
      onScheduled(appointment.id);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to schedule appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const isEmergencyAppointment = appointmentTypes.find(type => type.id === selectedType)?.name.toLowerCase() === 'emergency';

  return (
    <div ref={formRef} className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Schedule Appointment</h2>
      
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-6">
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
            Available Time Slots
          </label>
          <div className="grid grid-cols-3 gap-2">
            {availableSlots.map((slot) => (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(slot.id)}
                className={`flex items-center justify-center px-4 py-2 rounded-md border ${
                  selectedSlot === slot.id
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'hover:bg-gray-50'
                }`}
              >
                <Clock className="h-4 w-4 mr-2" />
                {format(new Date(slot.start_time), 'h:mm a')}
              </button>
            ))}
            {availableSlots.length === 0 && (
              <p className="col-span-3 text-center text-gray-500 py-4">
                No available slots for this date
              </p>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Appointment Type
          </label>
          <div className="grid grid-cols-1 gap-2">
            {appointmentTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => {
                  setSelectedType(type.id);
                  if (!type.name.toLowerCase().includes('emergency')) {
                    setEmergencyDescription('');
                  }
                }}
                className={`flex items-center justify-between px-4 py-2 rounded-md border ${
                  selectedType === type.id
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'hover:bg-gray-50'
                } ${type.name.toLowerCase() === 'emergency' ? 'border-red-300 hover:bg-red-50' : ''}`}
              >
                <span>{type.name}</span>
                <span className="text-sm text-gray-500">
                  {type.duration.replace(':', 'h ')}m
                </span>
              </button>
            ))}
          </div>
        </div>

        {isEmergencyAppointment && (
          <div>
            <label className="block text-sm font-medium text-red-700 mb-2">
              Emergency Description *
            </label>
            <textarea
              value={emergencyDescription}
              onChange={(e) => setEmergencyDescription(e.target.value)}
              className="w-full px-4 py-2 border border-red-300 rounded-md focus:ring-red-500 focus:border-red-500"
              rows={3}
              placeholder="Please describe your emergency in detail..."
              required
            />
            <p className="mt-2 text-sm text-gray-600">
              This information will be immediately shared with our dental staff.
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={isLoading || !selectedSlot || !selectedType || (isEmergencyAppointment && !emergencyDescription.trim())}
            className={`px-4 py-2 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed ${
              isEmergencyAppointment ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500'
            }`}
          >
            {isLoading ? 'Scheduling...' : `Schedule ${isEmergencyAppointment ? 'Emergency ' : ''}Appointment`}
          </button>
        </div>
      </div>
    </div>
  );
};