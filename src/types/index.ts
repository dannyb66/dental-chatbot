export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface Patient {
  id: string;
  user_id: string;
  full_name: string;
  phone_number?: string;
  date_of_birth?: string;
  insurance_name?: string | null;
  is_primary: boolean;
  relationship?: string;
  created_at: string;
  updated_at: string;
}

export interface VerifiedPatient extends Patient {
  verified: true;
}

export interface Appointment {
  id: string;
  patient_id: string;
  appointment_type_id: string;
  start_time: string;
  end_time: string;
  emergency_description: string | null;
  family_group_id: string | null;
  status: 'scheduled' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
  appointment_types?: AppointmentType;
}

export interface AppointmentType {
  id: string;
  name: string;
  duration: string;
  created_at: string;
  updated_at: string;
}

export interface AvailableSlot {
  id: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface FamilyMember extends Patient {
  relationship: string;
}

export interface FamilyAppointment extends Appointment {
  patient: Patient;
}