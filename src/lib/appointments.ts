import { supabase } from './supabase';
import { Patient, Appointment, AppointmentType, AvailableSlot, FamilyMember } from '../types';

export async function getAvailableSlots(date: Date): Promise<AvailableSlot[]> {
  try {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const now = new Date();

    const { data: slots, error } = await supabase
      .from('available_slots')
      .select('*')
      .gte('start_time', date.toDateString() === now.toDateString() ? now.toISOString() : startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .eq('is_available', true)
      .order('start_time', { ascending: true });

    if (error) throw error;

    // Additional filter to ensure slots are in the future
    const futureSlots = slots?.filter(slot => new Date(slot.start_time) > now) || [];
    return futureSlots;
  } catch (error) {
    console.error('Error fetching available slots:', error);
    throw error;
  }
}

export async function getAppointmentTypes(): Promise<AppointmentType[]> {
  try {
    const { data: types, error } = await supabase
      .from('appointment_types')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return types || [];
  } catch (error) {
    console.error('Error fetching appointment types:', error);
    throw error;
  }
}

export async function bookAppointment(
  patientId: string,
  slotId: string,
  appointmentTypeId: string,
  emergencyDescription?: string
): Promise<Appointment> {
  try {
    const { data, error } = await supabase.rpc('book_appointment', {
      p_patient_id: patientId,
      p_slot_id: slotId,
      p_appointment_type_id: appointmentTypeId,
      p_emergency_description: emergencyDescription
    });

    if (error) throw error;

    const appointmentId = data.appointment_id;
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*, appointment_types(*)')
      .eq('id', appointmentId)
      .single();

    if (fetchError) throw fetchError;
    return appointment;
  } catch (error) {
    console.error('Error booking appointment:', error);
    throw error;
  }
}

export async function cancelAppointment(appointmentId: string): Promise<void> {
  try {
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('id', appointmentId)
      .single();

    if (fetchError) throw fetchError;

    // Update appointment status
    const { error: updateError } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId);

    if (updateError) throw updateError;

    // Make the slot available again
    const { error: slotError } = await supabase
      .from('available_slots')
      .update({ is_available: true })
      .eq('start_time', appointment.start_time)
      .eq('end_time', appointment.end_time);

    if (slotError) throw slotError;
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    throw error;
  }
}

export async function rescheduleAppointment(
  appointmentId: string,
  newSlotId: string
): Promise<Appointment> {
  try {
    const { data, error } = await supabase.rpc('reschedule_appointment', {
      p_appointment_id: appointmentId,
      p_new_slot_id: newSlotId
    });

    if (error) throw error;

    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*, appointment_types(*)')
      .eq('id', appointmentId)
      .single();

    if (fetchError) throw fetchError;
    return appointment;
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    throw error;
  }
}

export async function getPatientAppointments(patientId: string): Promise<Appointment[]> {
  try {
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, appointment_types(*)')
      .eq('patient_id', patientId)
      .eq('status', 'scheduled')
      .order('start_time', { ascending: true });

    if (error) throw error;
    return appointments || [];
  } catch (error) {
    console.error('Error fetching patient appointments:', error);
    throw error;
  }
}

export async function getLatestAppointment(patientId: string): Promise<Appointment | null> {
  try {
    // First, check if the patient is primary
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('is_primary')
      .eq('id', patientId)
      .limit(1);

    if (patientError) {
      console.error('Error checking patient status:', patientError);
      return null;
    }

    const isPrimary = patient?.[0]?.is_primary;

    // Get the patient's own appointment
    const { data: ownAppointments, error: ownError } = await supabase
      .from('appointments')
      .select(`
        *,
        appointment_types (*),
        patients (
          id,
          full_name,
          is_primary
        )
      `)
      .eq('patient_id', patientId)
      .eq('status', 'scheduled')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(1);

    if (ownError) {
      console.error('Error fetching own appointment:', ownError);
      return null;
    }

    const ownAppointment = ownAppointments?.[0];

    // If patient has their own appointment or is not primary, return that
    if (ownAppointment || !isPrimary) {
      return ownAppointment || null;
    }

    // If primary patient has no appointment, check family member appointments
    const { data: familyMembers, error: familyError } = await supabase
      .from('family_relationships')
      .select('family_member_id')
      .eq('primary_patient_id', patientId);

    if (familyError || !familyMembers?.length) {
      return null;
    }

    const familyMemberIds = familyMembers.map(fm => fm.family_member_id);

    // Get the earliest family member appointment
    const { data: familyAppointments, error: familyAppointmentsError } = await supabase
      .from('appointments')
      .select(`
        *,
        appointment_types (*),
        patients (
          id,
          full_name,
          is_primary
        )
      `)
      .in('patient_id', familyMemberIds)
      .eq('status', 'scheduled')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(1);

    if (familyAppointmentsError) {
      console.error('Error fetching family appointments:', familyAppointmentsError);
      return null;
    }

    return familyAppointments?.[0] || null;
  } catch (error) {
    console.error('Error in getLatestAppointment:', error);
    return null;
  }
}

export async function handleVerificationResponse(input: string): Promise<{ verified: boolean; patient?: Patient; message?: string }> {
  const verificationPattern = /([^,]+),\s*(\d{10}),\s*(\d{4}-\d{2}-\d{2})/;
  const match = input.match(verificationPattern);

  if (!match) {
    return {
      verified: false,
      message: "Please provide your information in the correct format: [Full Name], [10-digit phone], [YYYY-MM-DD]"
    };
  }

  const [_, fullName, phoneNumber, dateOfBirth] = match;
  const formattedPhone = `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6)}`;

  try {
    // First, try to find the patient with exact phone and DOB match
    const { data: patients, error } = await supabase
      .from('patients')
      .select('*')
      .eq('phone_number', formattedPhone)
      .eq('date_of_birth', dateOfBirth)
      .eq('is_primary', true)  // Make sure we get the primary patient
      .limit(1);

    console.log('Verification query result:', { patients, error });

    if (error || !patients || patients.length === 0) {
      return {
        verified: false,
        message: "I couldn't find any records matching your information. If you're a new patient, would you like to register?"
      };
    }

    const patient = patients[0];

    // Case-insensitive name comparison
    const providedName = fullName.toLowerCase().trim();
    const storedName = patient.full_name.toLowerCase().trim();

    if (providedName !== storedName) {
      return {
        verified: false,
        message: "The name provided doesn't match our records. Please verify your information and try again."
      };
    }

    // If we get here, the patient is verified
    const verifiedPatient = {
      ...patient,
      verified: true
    };

    console.log('Patient verified:', verifiedPatient);

    return {
      verified: true,
      patient: verifiedPatient
    };
  } catch (error) {
    console.error('Error verifying patient:', error);
    return {
      verified: false,
      message: "There was an error verifying your information. Please try again."
    };
  }
}

export async function getFamilyMembers(userId: string, verifiedPatient?: Patient): Promise<{ primaryPatient: Patient; familyMembers: FamilyMember[] }> {
  try {
    console.log('Getting family members for user:', userId);
    console.log('Verified patient:', verifiedPatient);

    // First, get the primary patient using verified patient details if available
    let query = supabase
      .from('patients')
      .select('*')
      .eq('user_id', userId)
      .eq('is_primary', true);

    // If verified patient details are available, use them to narrow down the search
    if (verifiedPatient) {
      query = query
        .eq('phone_number', verifiedPatient.phone_number)
        .eq('date_of_birth', verifiedPatient.date_of_birth);
    }

    const { data: primaryPatients, error: primaryError } = await query.limit(1);

    if (primaryError) {
      console.error('Error getting primary patient:', primaryError);
      throw primaryError;
    }

    const primaryPatient = primaryPatients?.[0];
    if (!primaryPatient) {
      console.log('No primary patient found');
      return { primaryPatient: null, familyMembers: [] };
    }

    console.log('Found primary patient:', primaryPatient);

    // Then get all family relationships and member details
    const { data: relationships, error: relationError } = await supabase
      .from('family_relationships')
      .select(`
        id,
        relationship,
        family_member:family_member_id (*)
      `)
      .eq('primary_patient_id', primaryPatient.id);

    if (relationError) {
      console.error('Error getting relationships:', relationError);
      throw relationError;
    }

    if (!relationships) {
      console.log('No relationships found');
      return { primaryPatient, familyMembers: [] };
    }

    // Map the relationships to FamilyMember objects
    const familyMembers = relationships.map(relation => ({
      ...relation.family_member,
      relationship: relation.relationship
    }));

    console.log('Found family members:', familyMembers);

    return { primaryPatient, familyMembers };
  } catch (error) {
    console.error('Error in getFamilyMembers:', error);
    throw new Error('Failed to fetch family members');
  }
}

export async function addFamilyMember(
  primaryPatientId: string,
  memberData: {
    fullName: string;
    relationship: string;
    userId: string;
  }
): Promise<FamilyMember> {
  try {
    // First, create the family member as a patient
    const { data: newPatient, error: patientError } = await supabase
      .from('patients')
      .insert([
        {
          full_name: memberData.fullName,
          user_id: memberData.userId,
          is_primary: false
        }
      ])
      .select()
      .single();

    if (patientError) throw patientError;

    // Then create the family relationship
    const { data: relationship, error: relationError } = await supabase
      .from('family_relationships')
      .insert([
        {
          primary_patient_id: primaryPatientId,
          family_member_id: newPatient.id,
          relationship: memberData.relationship
        }
      ])
      .select()
      .single();

    if (relationError) throw relationError;

    // Return the combined data
    return {
      ...newPatient,
      relationship: relationship.relationship
    };
  } catch (error) {
    console.error('Error adding family member:', error);
    throw new Error('Failed to add family member');
  }
}

export async function findConsecutiveSlots(
  date: Date,
  numSlots: number
): Promise<{ slots: AvailableSlot[]; validInitialSlots: AvailableSlot[] } | null> {
  try {
    // Get all available slots for the day
    const slots = await getAvailableSlots(date);
    if (!slots || slots.length < numSlots) return null;

    // Find all possible consecutive slot groups and their initial slots
    const validInitialSlots: AvailableSlot[] = [];
    const consecutiveGroups: AvailableSlot[][] = [];

    for (let i = 0; i <= slots.length - numSlots; i++) {
      let consecutive = true;
      const group = [slots[i]];

      for (let j = 1; j < numSlots; j++) {
        const currentSlotEnd = new Date(slots[i + j - 1].end_time);
        const nextSlotStart = new Date(slots[i + j].start_time);
        
        if (currentSlotEnd.getTime() !== nextSlotStart.getTime()) {
          consecutive = false;
          break;
        }
        group.push(slots[i + j]);
      }

      if (consecutive) {
        consecutiveGroups.push(group);
        validInitialSlots.push(slots[i]);
      }
    }

    // If no valid consecutive slots found, return null
    if (validInitialSlots.length === 0) {
      return null;
    }

    // Return the first group of consecutive slots and all valid initial slots
    return {
      slots: consecutiveGroups[0],
      validInitialSlots
    };
  } catch (error) {
    console.error('Error finding consecutive slots:', error);
    throw error;
  }
}

export async function bookFamilyAppointments(
  appointments: Array<{
    patientId: string;
    slotId: string;
    appointmentTypeId: string;
  }>
): Promise<Appointment[]> {
  try {
    const familyGroupId = crypto.randomUUID();
    const bookedAppointments: Appointment[] = [];

    for (const appt of appointments) {
      const { data, error } = await supabase.rpc('book_appointment', {
        p_patient_id: appt.patientId,
        p_slot_id: appt.slotId,
        p_appointment_type_id: appt.appointmentTypeId
      });

      if (error) throw error;

      const appointmentId = data.appointment_id;

      // Update the appointment with the family group ID
      const { data: updatedAppointment, error: updateError } = await supabase
        .from('appointments')
        .update({ family_group_id: familyGroupId })
        .eq('id', appointmentId)
        .select('*, appointment_types(*)')
        .single();

      if (updateError) throw updateError;
      bookedAppointments.push(updatedAppointment);
    }

    return bookedAppointments;
  } catch (error) {
    console.error('Error booking family appointments:', error);
    throw error;
  }
}

export async function getFamilyAppointments(appointmentId: string): Promise<Appointment[]> {
  try {
    // Get the family group ID for this appointment
    const { data: appointments, error: appointmentError } = await supabase
      .from('appointments')
      .select('family_group_id')
      .eq('id', appointmentId)
      .limit(1);

    if (appointmentError || !appointments?.length) {
      return [];
    }

    const familyGroupId = appointments[0].family_group_id;
    if (!familyGroupId) {
      return [];
    }

    // Get all appointments in this family group
    const { data: familyAppointments, error: familyError } = await supabase
      .from('appointments')
      .select(`
        *,
        appointment_types (*),
        patients (
          id,
          full_name,
          is_primary
        )
      `)
      .eq('family_group_id', familyGroupId)
      .eq('status', 'scheduled')
      .neq('id', appointmentId) // Exclude the current appointment
      .order('start_time', { ascending: true });

    if (familyError) {
      console.error('Error fetching family appointments:', familyError);
      return [];
    }

    return familyAppointments || [];
  } catch (error) {
    console.error('Error in getFamilyAppointments:', error);
    return [];
  }
}