import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, X, Users } from 'lucide-react';
import { Appointment, FamilyMember } from '../types';
import { 
  cancelAppointment, 
  rescheduleAppointment, 
  getAvailableSlots,
  getFamilyMembers 
} from '../lib/appointments';
import { supabase } from '../lib/supabase';

interface AppointmentManagerProps {
  appointment: Appointment;
  verifiedPatientId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export const AppointmentManager: React.FC<AppointmentManagerProps> = ({
  appointment,
  verifiedPatientId,
  onComplete,
  onCancel
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(
    new Date(new Date(appointment.start_time).toLocaleDateString())
  );
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<'reschedule' | 'cancel' | null>(null);
  const [familyAppointments, setFamilyAppointments] = useState<Appointment[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string>(appointment.id);
  const [isPrimaryPatient, setIsPrimaryPatient] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Check if the verified patient is the primary patient
  useEffect(() => {
    const checkPrimaryPatient = async () => {
      try {
        const { data: patient, error } = await supabase
          .from('patients')
          .select('is_primary')
          .eq('id', verifiedPatientId)
          .single();

        if (error) throw error;
        setIsPrimaryPatient(patient?.is_primary || false);
      } catch (error) {
        console.error('Error checking primary patient status:', error);
      }
    };

    checkPrimaryPatient();
  }, [verifiedPatientId]);

  // Load family appointments if they exist
  useEffect(() => {
    const loadFamilyAppointments = async () => {
      try {
        if (appointment.family_group_id) {
          const { data: appointments, error } = await supabase
            .from('appointments')
            .select(`
              *,
              appointment_types (
                name,
                duration
              ),
              patients (
                full_name,
                is_primary
              )
            `)
            .eq('family_group_id', appointment.family_group_id)
            .neq('id', appointment.id)
            .eq('status', 'scheduled');

          if (error) throw error;
          setFamilyAppointments(appointments || []);
        }
      } catch (error) {
        console.error('Error loading family appointments:', error);
        setError('Failed to load family appointments');
      }
    };

    loadFamilyAppointments();
  }, [appointment]);

  useEffect(() => {
    if (selectedDate && action === 'reschedule') {
      loadAvailableSlots();
    }
    // Scroll to form when it mounts
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [selectedDate, action]);

  const loadAvailableSlots = async () => {
    try {
      const slots = await getAvailableSlots(selectedDate);
      setAvailableSlots(slots.map(slot => ({
        ...slot,
        localTime: new Date(slot.start_time)
      })));
      setSelectedSlot(null);
    } catch (error) {
      setError('Failed to load available slots');
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDateValue = e.target.value;
    const date = new Date(selectedDateValue + "T00:00:00");
    setSelectedDate(date);
  };

  const handleReschedule = async () => {
    if (!selectedSlot) {
      setError('Please select a new time slot');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await rescheduleAppointment(selectedAppointmentId, selectedSlot);
      onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to reschedule appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAppointment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await cancelAppointment(selectedAppointmentId);
      onComplete();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to cancel appointment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppointmentSelect = (appointmentId: string) => {
    setSelectedAppointmentId(appointmentId);
    setSelectedSlot(null);
    setError(null);
  };

  // Check if the verified patient can manage this appointment
  const canManageAppointment = isPrimaryPatient || appointment.patient_id === verifiedPatientId;

  if (!canManageAppointment) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="text-red-600">
          You are not authorized to manage this appointment.
        </div>
      </div>
    );
  }

  const selectedAppointment = selectedAppointmentId === appointment.id 
    ? appointment 
    : familyAppointments.find(a => a.id === selectedAppointmentId) || appointment;

  return (
    <div ref={formRef} className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Manage Appointment</h2>
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

      {/* Show all appointments in the family group */}
      <div className="mb-6 space-y-4">
        <div 
          className={`p-4 rounded-md cursor-pointer transition-colors ${
            selectedAppointmentId === appointment.id
              ? 'bg-blue-50 border-2 border-blue-500'
              : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
          }`}
          onClick={() => handleAppointmentSelect(appointment.id)}
        >
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-semibold flex items-center">
              Primary Patient
              <Users className="ml-2 h-4 w-4 text-blue-500" />
            </h3>
            <span className="text-sm text-gray-500">
              {format(new Date(appointment.start_time), 'h:mm a')}
            </span>
          </div>
          <p className="text-gray-600">
            Date: {format(new Date(appointment.start_time), 'MMMM d, yyyy')}
          </p>
          <p className="text-gray-600">
            Type: {appointment.appointment_types?.name || 'N/A'}
          </p>
        </div>

        {familyAppointments.length > 0 && (
          <>
            <h3 className="text-lg font-medium text-gray-900">Family Member Appointments</h3>
            {familyAppointments.map((familyAppointment) => (
              <div
                key={familyAppointment.id}
                className={`p-4 rounded-md cursor-pointer transition-colors ${
                  selectedAppointmentId === familyAppointment.id
                    ? 'bg-blue-50 border-2 border-blue-500'
                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                }`}
                onClick={() => handleAppointmentSelect(familyAppointment.id)}
              >
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium flex items-center">
                    {familyAppointment.patients?.full_name}
                    <Users className="ml-2 h-4 w-4 text-gray-500" />
                  </h4>
                  <span className="text-sm text-gray-500">
                    {format(new Date(familyAppointment.start_time), 'h:mm a')}
                  </span>
                </div>
                <p className="text-gray-600">
                  Date: {format(new Date(familyAppointment.start_time), 'MMMM d, yyyy')}
                </p>
                <p className="text-gray-600">
                  Type: {familyAppointment.appointment_types?.name || 'N/A'}
                </p>
              </div>
            ))}
          </>
        )}
      </div>

      {!action && (
        <div className="space-y-3">
          <button
            onClick={() => setAction('reschedule')}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Reschedule Selected Appointment
          </button>
          <button
            onClick={() => setAction('cancel')}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            Cancel Selected Appointment
          </button>
        </div>
      )}

      {action === 'reschedule' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select New Date
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

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setAction(null)}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Back
            </button>
            <button
              onClick={handleReschedule}
              disabled={isLoading || !selectedSlot}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Rescheduling...' : 'Confirm Reschedule'}
            </button>
          </div>
        </div>
      )}

      {action === 'cancel' && (
        <div className="space-y-6">
          <div className="bg-red-50 p-4 rounded-md">
            <p className="text-red-700">
              Are you sure you want to cancel this appointment? This action cannot be undone.
            </p>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => setAction(null)}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Back
            </button>
            <button
              onClick={handleCancelAppointment}
              disabled={isLoading}
              className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};