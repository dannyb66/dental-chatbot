import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from './supabase';
import { format } from 'date-fns';
import { getAvailableSlots, rescheduleAppointment, getFamilyMembers } from './appointments';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

// Practice information for general inquiries
const practiceInfo = {
  insurance: {
    accepted: [
      'All major dental insurance plans accepted',
      'Delta Dental',
      'Cigna',
      'Aetna',
      'MetLife',
      'United Healthcare',
      'Guardian',
      'BlueCross BlueShield'
    ],
    selfPay: {
      options: [
        'Flexible payment plans available',
        'Membership plans for regular preventive care',
        'Cash, credit cards, and HSA/FSA accepted',
        'CareCredit financing available'
      ],
      membership: {
        benefits: [
          'Two cleanings per year included',
          'X-rays included',
          'Discounts on additional treatments',
          'No waiting periods',
          'No annual maximums'
        ]
      }
    }
  },
  hours: {
    monday: '8:00 AM - 6:00 PM',
    tuesday: '8:00 AM - 6:00 PM',
    wednesday: '8:00 AM - 6:00 PM',
    thursday: '8:00 AM - 6:00 PM',
    friday: '8:00 AM - 6:00 PM',
    saturday: '8:00 AM - 6:00 PM',
    sunday: 'Closed'
  },
  location: {
    address: '123 Dental Way, Suite 100',
    city: 'Dentalville',
    state: 'ST',
    zip: '12345',
    parking: 'Free parking available',
    accessibility: 'Wheelchair accessible'
  }
};

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// Helper function to check if a message matches any keywords
function matchesKeywords(message: string, keywords: string[]): boolean {
  const normalizedMessage = message.toLowerCase();
  return keywords.some(keyword => normalizedMessage.includes(keyword.toLowerCase()));
}

function containsAnyKeyword(message: string, keywords: string[]): boolean {
  const normalizedMessage = message.toLowerCase();
  return keywords.some(keyword => normalizedMessage.includes(keyword.toLowerCase()));
}

// Helper function to check if a message includes a specific phrase
function messageIncludes(message: string, phrase: string): boolean {
  return message.toLowerCase().includes(phrase.toLowerCase());
}

// Function to handle general inquiries
function handleGeneralInquiry(message: string): string | null {
  const insuranceKeywords = ['insurance', 'coverage', 'covered', 'plan', 'provider'];
  const paymentKeywords = ['payment', 'pay', 'cost', 'price', 'fee', 'cash', 'credit', 'finance'];
  const selfPayKeywords = ['no insurance', 'without insurance', 'self pay', 'self-pay', 'membership'];
  const hoursKeywords = ['hours', 'open', 'close', 'time', 'schedule', 'when'];
  const locationKeywords = ['where', 'location', 'address', 'directions', 'parking'];

  const normalizedMessage = message.toLowerCase();

  if (matchesKeywords(normalizedMessage, insuranceKeywords)) {
    return `We accept all major dental insurance plans, including:
${practiceInfo.insurance.accepted.join('\n')}

For specific coverage details, please have your insurance card ready when you visit.`;
  }

  if (matchesKeywords(normalizedMessage, selfPayKeywords)) {
    return `For patients without insurance, we offer several options:
${practiceInfo.insurance.selfPay.options.join('\n')}

Our membership plan includes:
${practiceInfo.insurance.selfPay.membership.benefits.join('\n')}`;
  }

  if (matchesKeywords(normalizedMessage, paymentKeywords)) {
    return `We offer flexible payment options:
• All major credit cards accepted
• CareCredit financing available
• Payment plans for major procedures
• HSA/FSA accounts accepted

For patients without insurance, we also offer an affordable membership plan.`;
  }

  if (matchesKeywords(normalizedMessage, hoursKeywords)) {
    return `Our office hours are:
Monday-Saturday: 8:00 AM - 6:00 PM
Sunday: Closed

We also accommodate emergency appointments during business hours.`;
  }

  if (matchesKeywords(normalizedMessage, locationKeywords)) {
    return `We are located at:
${practiceInfo.location.address}
${practiceInfo.location.city}, ${practiceInfo.location.state} ${practiceInfo.location.zip}

${practiceInfo.location.parking}
${practiceInfo.location.accessibility}`;
  }

  return null;
}

export async function getChatResponse(
  messages: { role: string; content: string }[],
  patientContext?: {
    isAuthenticated: boolean;
    patientName?: string;
    hasAppointments?: boolean;
    isRescheduling?: boolean;
    isVerified?: boolean;
    hasFamilyMembers?: boolean;
  }
) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage.role === 'user') {
      // Check for general inquiries first
      const generalResponse = handleGeneralInquiry(lastUserMessage.content);
      if (generalResponse) {
        return generalResponse;
      }

      // Check for family-related keywords
      const familyKeywords = ['family', 'together', 'kids', 'children', 'child', 'spouse', 'wife', 'husband', 'daughter', 'son', 'back-to-back', 'consecutive'];
      const bookingKeywords = ['schedule', 'book', 'booking', 'make', 'set up', 'appointment', 'visit'];
      const isFamilyBooking = containsAnyKeyword(lastUserMessage.content.toLowerCase(), familyKeywords) && 
                             containsAnyKeyword(lastUserMessage.content.toLowerCase(), bookingKeywords);

      // Check for verification information in the message
      const verificationPattern = /([^,]+),\s*(\d{10}),\s*(\d{4}-\d{2}-\d{2})/;
      const match = lastUserMessage.content.match(verificationPattern);
      
      if (match) {
        const [_, fullName, phoneNumber, dateOfBirth] = match;
        console.log('Attempting verification for:', { fullName, phoneNumber, dateOfBirth });
        
        const verificationResult = await verifyPatient(
          fullName.trim(),
          phoneNumber.trim(),
          dateOfBirth.trim()
        );
        
        console.log('Verification result:', verificationResult);
        
        if (verificationResult.verified === true) {
          // Check if this was a family booking request
          console.log('Checking for family booking flow...');
          const isFamilyBookingFlow = messages.some(msg => 
            msg.role === 'assistant' && 
            (messageIncludes(msg.content.toLowerCase(), 'schedule appointments for your family') ||
             messageIncludes(msg.content.toLowerCase(), 'family visit') ||
             messageIncludes(msg.content.toLowerCase(), 'family appointment'))
          );

          console.log('Family booking flow check:', {
            isFamilyBooking,
            isFamilyBookingFlow,
            messageHistory: messages.map(m => ({ role: m.role, content: m.content }))
          });

          if (isFamilyBookingFlow || isFamilyBooking) {
            console.log('Entering family booking flow...');
            const { primaryPatient, familyMembers } = await getFamilyMembers(verificationResult.patient.user_id, verificationResult.patient);
            console.log('Primary patient:', primaryPatient);
            console.log('Family members:', familyMembers);

            if (familyMembers && familyMembers.length > 0) {
              const familyList = familyMembers
                .map(member => `${member.full_name} (${member.relationship})`)
                .join(', ');

              return `Thank you for verifying your information, ${verificationResult.patient.full_name}. I can see you have the following family members registered: ${familyList}. Would you like to add more family members or proceed with scheduling appointments for your family?`;
            } else {
              return `Thank you for verifying your information, ${verificationResult.patient.full_name}. I notice you don't have any family members registered yet. Would you like to add family members first?`;
            }
          }

          // Fetch the latest appointment
          const appointment = await getLatestAppointment(verificationResult.patient.id);
          
          if (appointment) {
            const appointmentDate = format(new Date(appointment.start_time), 'MMMM d, yyyy');
            const appointmentTime = format(new Date(appointment.start_time), 'h:mm a');
            const appointmentType = appointment.appointment_types.name;
            
            return `Thank you for verifying your information, ${verificationResult.patient.full_name}. I can see your upcoming appointment:\n\n` +
              `Type: ${appointmentType}\n` +
              `Date: ${appointmentDate}\n` +
              `Time: ${appointmentTime}\n\n` +
              `Would you like to reschedule or cancel this appointment?`;
          } else {
            return `Thank you for verifying your information, ${verificationResult.patient.full_name}. I don't see any upcoming appointments scheduled for you. Would you like to schedule one?`;
          }
        } else {
          return verificationResult.message;
        }
      }

      // If it's a family booking request and user is not verified
      if (isFamilyBooking && !patientContext?.isVerified) {
        return `I'll help you schedule appointments for your family. First, I'll need to verify your identity. Please provide your information in this format:\n` +
               `[Full Name], [10-digit phone], [YYYY-MM-DD]\n\n` +
               `For example: John Smith, 1234567890, 1990-01-01`;
      }

      // Check if this is a rescheduling time response
      const timePattern = /(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i;
      const previousMessages = messages.slice(0, -1);
      const isReschedulingFlow = previousMessages.some(msg => 
        msg.role === 'assistant' && 
        msg.content.toLowerCase().includes('would you like to reschedule')
      );

      if (isReschedulingFlow && timePattern.test(lastUserMessage.content)) {
        // Get the patient's latest appointment
        const patientVerification = previousMessages.find(msg => {
          const match = msg.content.match(verificationPattern);
          return match && msg.role === 'user';
        });

        if (patientVerification) {
          const [_, fullName, phoneNumber, dateOfBirth] = patientVerification.content.match(verificationPattern)!;
          const verificationResult = await verifyPatient(
            fullName.trim(),
            phoneNumber.trim(),
            dateOfBirth.trim()
          );

          if (verificationResult.verified === true) {
            const appointment = await getLatestAppointment(verificationResult.patient.id);
            if (appointment) {
              try {
                const result = await handleRescheduling(appointment, lastUserMessage.content);
                return `${result.message} Is there anything else I can help you with?`;
              } catch (error) {
                if (error instanceof Error) {
                  if (error.message.includes('No available slots')) {
                    return `I apologize, but there are no available slots on that date. Would you like to try a different day?`;
                  }
                }
                return `I apologize, but I couldn't reschedule your appointment. Would you like to try a different time?`;
              }
            }
          }
        }
      }
    }

    const contextPrompt = `You are a dental practice assistant chatbot. ${
      patientContext?.isAuthenticated
        ? `You are talking to ${patientContext.patientName || 'a patient'}${
            patientContext.hasFamilyMembers 
              ? ' who has family members registered with us'
              : ''
          }.`
        : 'You are talking to a new patient.'
    }

Practice Information:
- Hours: Monday-Saturday, 8am-6pm
- Services: Cleanings, General Checkups, Emergency Care
- Insurance: Accepts all major dental insurance plans
- Location: Available upon request

Your role is to:
1. Help patients schedule appointments
2. Answer questions about services and insurance
3. Handle emergency situations with urgency
4. Maintain a friendly, professional tone

Important rules:
- When verifying patient identity, always ask for:
  * Full name (as registered with us)
  * Phone number (10 digits)
  * Date of birth (YYYY-MM-DD)
- For emergencies, express urgency and care
- Guide new patients through registration
- Be concise but thorough
- For appointment cancellations, always ask for verification first

Family Booking Context:
${patientContext?.hasFamilyMembers
  ? '- Patient has registered family members\n- Can schedule back-to-back appointments for family\n- Actively suggest family scheduling when appropriate'
  : '- No family members registered yet\n- Suggest adding family members when family-related keywords are used'
}

Verification format instructions:
- Ask patients to provide their information in this exact format:
  [Full Name], [10-digit phone], [YYYY-MM-DD]
- Example: "John Smith, 1234567890, 1990-01-01"

If a patient asks about their information or appointments, or wants to cancel/reschedule, respond with:
"To protect your privacy, I'll need to verify your identity. Please provide your information in this format:
[Full Name], [10-digit phone], [YYYY-MM-DD]

For example: John Smith, 1234567890, 1990-01-01"

When handling family-related requests:
1. If the patient has family members registered:
   - Acknowledge their existing family members
   - Ask if they want to add more members or schedule appointments
2. If no family members are registered:
   - Suggest registering family members first
   - Guide them through the family registration process`;

    const chat = model.startChat({
      history: messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: msg.content,
      })),
      generationConfig: {
        maxOutputTokens: 250,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(contextPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error getting chat response:', error);
    return "I apologize, but I'm having trouble processing your request right now. Please try again in a moment.";
  }
}

async function verifyPatient(fullName: string, phoneNumber: string, dateOfBirth: string) {
  try {
    // Format the phone number to match database format
    const formattedPhone = formatPhoneNumber(phoneNumber);

    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('phone_number', formattedPhone)
      .eq('date_of_birth', dateOfBirth)
      .single();

    if (error || !data) {
      return {
        verified: false,
        message: "I couldn't find any records matching your information. If you're a new patient, would you like to register? Otherwise, please verify your information and try again."
      };
    }

    // Verify the name matches (case-insensitive)
    const providedName = fullName.toLowerCase().trim();
    const storedName = data.full_name.toLowerCase().trim();

    if (providedName === storedName) {
      return { 
        verified: true, 
        patient: { ...data, verified: true }
      };
    }

    return {
      verified: false,
      message: `I found a record with this phone number and date of birth, but under a different name. Please verify your information and try again.`
    };
  } catch (error) {
    console.error('Error verifying patient:', error);
    return {
      verified: false,
      message: 'There was an error verifying your information. Please try again.'
    };
  }
}

async function handleRescheduling(appointment: any, newTime: string) {
  try {
    // Parse the requested time
    const [hours, minutes] = newTime.match(/(\d+)(?::(\d+))?(?:\s*(am|pm))?/i)
      ?.slice(1)
      .map(x => x || '00') || [];
    
    let hour = parseInt(hours);
    const minute = parseInt(minutes);
    
    // Adjust hour for PM times if not in 24-hour format
    if (newTime.toLowerCase().includes('pm') && hour < 12) {
      hour += 12;
    }
    // Adjust for 12 AM
    if (newTime.toLowerCase().includes('am') && hour === 12) {
      hour = 0;
    }

    // Get the date from the current appointment
    const currentDate = new Date(appointment.start_time);
    
    // Create the new target date
    const targetDate = new Date(currentDate);
    targetDate.setHours(hour, minute, 0, 0);

    // Get available slots for the target date
    const slots = await getAvailableSlots(targetDate);
    
    // First try to find an exact match
    let targetSlot = slots.find(slot => {
      const slotTime = new Date(slot.start_time);
      return slotTime.getHours() === hour && slotTime.getMinutes() === minute;
    });

    // If no exact match, find the nearest available slot
    if (!targetSlot) {
      targetSlot = await findNearestAvailableSlot(slots, targetDate);
      if (!targetSlot) {
        throw new Error('No available slots found for the requested date');
      }
    }

    // Reschedule the appointment
    const updatedAppointment = await rescheduleAppointment(appointment.id, targetSlot.id);
    
    // Format the new time for the response
    const newAppointmentTime = format(new Date(targetSlot.start_time), 'h:mm a');
    const isExactMatch = new Date(targetSlot.start_time).getHours() === hour && 
                        new Date(targetSlot.start_time).getMinutes() === minute;

    return {
      appointment: updatedAppointment,
      message: isExactMatch
        ? `I've successfully rescheduled your appointment to ${newAppointmentTime}.`
        : `The requested time wasn't available, but I've rescheduled your appointment to the nearest available time at ${newAppointmentTime}.`
    };
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    throw error;
  }
}

async function findNearestAvailableSlot(slots: any[], targetDate: Date) {
  if (!slots.length) return null;

  // Sort slots by the absolute difference between their start time and target time
  const sortedSlots = [...slots].sort((a, b) => {
    const aTime = new Date(a.start_time).getTime();
    const bTime = new Date(b.start_time).getTime();
    const targetTime = targetDate.getTime();
    return Math.abs(aTime - targetTime) - Math.abs(bTime - targetTime);
  });

  return sortedSlots[0];
}

async function getLatestAppointment(patientId: string) {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        *,
        appointment_types (
          name
        )
      `)
      .eq('patient_id', patientId)
      .eq('status', 'scheduled')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      console.error('Error fetching latest appointment:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getLatestAppointment:', error);
    return null;
  }
}