import React, { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Chat } from './components/Chat';
import { Auth } from './components/Auth';
import { AppointmentScheduler } from './components/AppointmentScheduler';
import { AppointmentManager } from './components/AppointmentManager';
import { PatientRegistration } from './components/PatientRegistration';
import { FamilyRegistration } from './components/FamilyRegistration';
import { FamilyScheduler } from './components/FamilyScheduler';
import { Message, Patient, Appointment, VerifiedPatient, FamilyMember } from './types';
import { MessageSquare, RefreshCw } from 'lucide-react';
import { supabase } from './lib/supabase';
import { getChatResponse } from './lib/gemini';
import { 
  getPatientAppointments, 
  getFamilyMembers, 
  getLatestAppointment,
  handleVerificationResponse 
} from './lib/appointments';

type ActiveForm = 'scheduler' | 'manager' | 'registration' | 'family-registration' | 'family-scheduler' | null;

const messageIncludes = (message: string, phrase: string): boolean => {
  return message.toLowerCase().includes(phrase.toLowerCase());
};

const messageEquals = (message: string, phrase: string): boolean => {
  return message.toLowerCase() === phrase.toLowerCase();
};

const containsAnyKeyword = (message: string, keywords: string[]): boolean => {
  return keywords.some(keyword => messageIncludes(message, keyword));
};

function App() {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: uuidv4(),
      role: 'assistant',
      content: 'Hello! I\'m your dental assistant. How can I help you today?',
      timestamp: new Date(),
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [patientInfo, setPatientInfo] = useState<Patient | null>(null);
  const [verifiedPatient, setVerifiedPatient] = useState<VerifiedPatient | null>(null);
  const [activeForm, setActiveForm] = useState<ActiveForm>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [appointments, setAppointments] = useState([]);
  const [isEmergencyAppointment, setIsEmergencyAppointment] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      fetchPatientInfo();
    }
  }, [session]);

  useEffect(() => {
    if (patientInfo) {
      fetchFamilyMembers();
      fetchAppointments();
    }
  }, [patientInfo]);

  useEffect(() => {
    if (verifiedPatient) {
      setPatientInfo(verifiedPatient);
      fetchFamilyMembers();
    }
  }, [verifiedPatient]);

  const fetchPatientInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (!error && data) {
        setPatientInfo(data);
        setVerifiedPatient({ ...data, verified: true });
      }
    } catch (error) {
      console.error('Error fetching patient info:', error);
    }
  };

  const fetchFamilyMembers = async () => {
    try {
      const { familyMembers: members } = await getFamilyMembers(session.user.id);
      setFamilyMembers(members);
    } catch (error) {
      console.error('Error fetching family members:', error);
    }
  };

  const fetchAppointments = async () => {
    try {
      const appointments = await getPatientAppointments(patientInfo.id);
      setAppointments(appointments);
    } catch (error) {
      console.error('Error fetching appointments:', error);
    }
  };

  const closeAllForms = () => {
    setActiveForm(null);
    setSelectedAppointment(null);
    setIsRescheduling(false);
    setIsEmergencyAppointment(false);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setMessages([
      {
        id: uuidv4(),
        role: 'assistant',
        content: 'Hello! I\'m your dental assistant. How can I help you today?',
        timestamp: new Date(),
      },
    ]);
    setPatientInfo(null);
    setVerifiedPatient(null);
    closeAllForms();
    setFamilyMembers([]);
    setAppointments([]);
    
    if (session?.user) {
      fetchPatientInfo();
    }
    
    setIsRefreshing(false);
  };

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const isRegistrationResponse = 
        messageEquals(content, 'yes') && 
        messages[messages.length - 1].role === 'assistant' && 
        messageIncludes(messages[messages.length - 1].content, 'like to register');

      const isSchedulingResponse = 
        messageEquals(content, 'yes') && 
        messages[messages.length - 1].role === 'assistant' && 
        messageIncludes(messages[messages.length - 1].content, 'like to schedule');

      const isAddFamilyMembersResponse =
        messageEquals(content, 'yes') &&
        messages[messages.length - 1].role === 'assistant' &&
        messageIncludes(messages[messages.length - 1].content, 'Would you like to add family members first');

      if (isAddFamilyMembersResponse && verifiedPatient) {
        closeAllForms();
        setActiveForm('family-registration');
        const botMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: 'I\'ll help you add your family members. Please use the form that has appeared to add your family members.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        setIsLoading(false);
        return;
      }

      if (isRegistrationResponse && session) {
        closeAllForms();
        setActiveForm('registration');
        const botMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: 'I\'ll help you register as a new patient. Please complete the registration form that has appeared.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        setIsLoading(false);
        return;
      }

      const bookingKeywords = ['schedule', 'book', 'make', 'set up', 'yes'];
      const rescheduleKeywords = ['reschedule', 'change', 'move', 'switch', 'different time', 'another time'];
      const cancelKeywords = ['cancel', 'remove', 'delete'];
      const emergencyKeywords = ['emergency', 'urgent', 'pain', 'severe'];
      const appointmentKeywords = ['appointment', 'booking', 'slot', 'time', 'schedule'];
      const newPatientKeywords = ['new patient', 'first time', 'register', 'sign up'];
      const familyKeywords = ['family', 'together', 'kids', 'children', 'child', 'spouse', 'wife', 'husband', 'daughter', 'son', 'back-to-back', 'consecutive'];
      
      const containsAppointment = containsAnyKeyword(content, appointmentKeywords);
      const isNewPatient = containsAnyKeyword(content, newPatientKeywords);
      const isFamilyRelated = containsAnyKeyword(content, familyKeywords);
      
      const isBooking = (containsAnyKeyword(content, bookingKeywords) && containsAppointment) || isSchedulingResponse;
      const isRescheduling = containsAnyKeyword(content, rescheduleKeywords) && containsAppointment;
      const isCancelling = containsAnyKeyword(content, cancelKeywords) && containsAppointment;
      const isEmergency = containsAnyKeyword(content, emergencyKeywords);

      if (isNewPatient && session) {
        closeAllForms();
        setActiveForm('registration');
        const botMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: 'I\'ll help you register as a new patient. Please complete the registration form that has appeared.',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        setIsLoading(false);
        return;
      }

      const verificationPattern = /([^,]+),\s*(\d{10}),\s*(\d{4}-\d{2}-\d{2})/i;
      const isVerificationResponse = verificationPattern.test(content);

      if (isVerificationResponse) {
        const verificationResult = await handleVerificationResponse(content);
        if (verificationResult?.verified) {
          setVerifiedPatient(verificationResult.patient);
          
          if (messages.some(msg => 
            msg.role === 'assistant' && 
            (messageIncludes(msg.content, 'Would you like to schedule one?') || 
             messageIncludes(msg.content, 'Would you like to schedule a new appointment?'))
          )) {
            closeAllForms();
            setActiveForm('scheduler');
            const botMessage: Message = {
              id: uuidv4(),
              role: 'assistant',
              content: 'Thank you for verifying your information. I\'ve opened the scheduling form for you to book your appointment.',
              timestamp: new Date(),
            };
            setMessages((prev) => [...prev, botMessage]);
            return;
          }

          // Handle family-related verification response
          if (messages.some(msg => 
            msg.role === 'assistant' && 
            messageIncludes(msg.content, 'schedule appointments for your family')
          )) {
            closeAllForms();
            if (familyMembers.length === 0) {
              closeAllForms();
              setActiveForm('family-registration');
              const botMessage: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: 'I\'ll help you add your family members. Please use the form that has appeared to add your family members.',
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, botMessage]);
            } else {
              setActiveForm('family-scheduler');
              const botMessage: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: 'Thank you for verifying your information. I\'ve opened the family scheduling form where you can select appointments for your family members.',
                timestamp: new Date(),
              };
              setMessages((prev) => [...prev, botMessage]);
            }
            return;
          }
        }
      }

      if ((isRescheduling || isCancelling || isBooking || isSchedulingResponse) && !verifiedPatient) {
        const botMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: 'To protect your privacy, I\'ll need to verify your identity first. Please provide your information in this format:\n[Full Name], [10-digit phone], [YYYY-MM-DD]\n\nFor example: John Smith, 1234567890, 1990-01-01',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMessage]);
        return;
      }

      // Handle family-related requests
      if (isFamilyRelated && containsAppointment) {
        if (!verifiedPatient) {
          const botMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: 'I\'ll help you schedule appointments for your family. First, I\'ll need to verify your identity. Please provide your information in this format:\n[Full Name], [10-digit phone], [YYYY-MM-DD]\n\nFor example: John Smith, 1234567890, 1990-01-01',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
          return;
        }

        closeAllForms();
        if (familyMembers.length === 0) {
          setActiveForm('family-registration');
          const botMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: 'I notice you don\'t have any family members registered yet. Please use the form that has appeared to add your family members.',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        } else {
          setActiveForm('family-scheduler');
          const botMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: 'I\'ve opened the family scheduling form where you can select appointments for your family members.',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        }
        return;
      }

      if ((isRescheduling || isCancelling || containsAppointment) && session && verifiedPatient) {
        const latestAppointment = await getLatestAppointment(verifiedPatient.id);
        if (latestAppointment) {
          closeAllForms();
          setSelectedAppointment(latestAppointment);
          setActiveForm('manager');
          setIsRescheduling(isRescheduling);
          const action = isRescheduling ? 'reschedule' : 'cancel';
          const botMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: `I've found your latest scheduled appointment. You can ${action} it using the form that has appeared.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        } else {
          const botMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: 'I don\'t see any upcoming appointments scheduled for you. Would you like to schedule a new appointment?',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        }
      } else if ((isBooking || isSchedulingResponse) && session) {
        if (!patientInfo && !verifiedPatient) {
          closeAllForms();
          setActiveForm('registration');
          const botMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: 'Before we schedule an appointment, I\'ll need to collect some information from you. Please complete the registration form that has appeared.',
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        } else {
          closeAllForms();
          setActiveForm('scheduler');
          setIsEmergencyAppointment(isEmergency);
          const botMessage: Message = {
            id: uuidv4(),
            role: 'assistant',
            content: `I'll help you schedule an appointment${isEmergency ? ' - I understand this is an emergency' : ''}. Please use the scheduling form that has appeared.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, botMessage]);
        }
      } else {
        const response = await getChatResponse(
          messages.concat(userMessage).map(msg => ({
            role: msg.role,
            content: msg.content,
          })),
          {
            isAuthenticated: !!session,
            patientName: verifiedPatient?.full_name || patientInfo?.full_name,
            hasAppointments: appointments.length > 0,
            isRescheduling,
            isVerified: !!verifiedPatient,
            hasFamilyMembers: familyMembers.length > 0
          }
        );

        const botMessage: Message = {
          id: uuidv4(),
          role: 'assistant',
          content: response,
          timestamp: new Date(),
        };
        
        setMessages((prev) => [...prev, botMessage]);
      }
    } catch (error) {
      console.error('Error in chat:', error);
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, session, patientInfo, appointments, isRescheduling, verifiedPatient, familyMembers]);

  const handleAppointmentScheduled = (appointmentId: string) => {
    closeAllForms();
    fetchAppointments();
    const confirmationMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: `Great! Your appointment has been scheduled successfully. ${
        isEmergencyAppointment 
          ? 'The dental office staff have been notified about the nature of your emergency and will look into it immediately.' 
          : ''
      } Is there anything else I can help you with?`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, confirmationMessage]);
    setIsEmergencyAppointment(false);
  };

  const handleFamilyAppointmentsScheduled = (appointmentIds: string[]) => {
    closeAllForms();
    fetchAppointments();
    const confirmationMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: 'Great! I\'ve successfully scheduled appointments for your family members. Is there anything else I can help you with?',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, confirmationMessage]);
  };

  const handleAppointmentManaged = () => {
    closeAllForms();
    fetchAppointments();
    const confirmationMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: 'Your appointment has been updated successfully. Is there anything else I can help you with?',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, confirmationMessage]);
  };

  const handleRegistrationComplete = async (newPatient: Patient) => {
    closeAllForms();
    setPatientInfo(newPatient);
    setVerifiedPatient({ ...newPatient, verified: true });
    
    const wasSchedulingFlow = messages.some(msg => 
      msg.role === 'assistant' && 
      msg.content.includes('Before we schedule an appointment')
    );

    if (wasSchedulingFlow) {
      setActiveForm('scheduler');
      const welcomeMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: 'Thank you for registering! I\'ve opened the scheduling form for you to book your appointment.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, welcomeMessage]);
    } else {
      const welcomeMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: 'Thank you for registering! Now I can help you schedule an appointment or answer any questions you have about our services.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, welcomeMessage]);
    }
  };

  const handleFamilyRegistrationComplete = async (members: FamilyMember[]) => {
    closeAllForms();
    await fetchFamilyMembers();
    setActiveForm('family-scheduler');
    const welcomeMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: 'Thank you for adding your family members! I\'ve opened the family scheduling form where you can schedule appointments for them.',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, welcomeMessage]);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="fixed top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition-all duration-200 z-50"
        title="Reset conversation"
      >
        <RefreshCw className={`w-6 h-6 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
      </button>

      <div className="max-w-2xl mx-auto mb-8 text-center">
        <div className="inline-flex items-center justify-center space-x-2 mb-4">
          <MessageSquare className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-800">Dental Assistant Chat</h1>
        </div>
        <p className="text-gray-600">
          Your friendly dental practice assistant, here to help with appointments and inquiries.
        </p>
      </div>
      
      {!session ? (
        <Auth />
      ) : (
        <div className="max-w-2xl mx-auto space-y-6">
          <Chat
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
          />
          
          {activeForm === 'registration' && (
            <PatientRegistration
              userId={session.user.id}
              onComplete={handleRegistrationComplete}
              onCancel={() => closeAllForms()}
            />
          )}
          
          {activeForm === 'scheduler' && (patientInfo || verifiedPatient) && (
            <AppointmentScheduler
              patientId={(verifiedPatient || patientInfo).id}
              onScheduled={handleAppointmentScheduled}
              onCancel={() => closeAllForms()}
              familyMembers={familyMembers}
            />
          )}

          {activeForm === 'manager' && selectedAppointment && (patientInfo || verifiedPatient) && (
            <AppointmentManager
              appointment={selectedAppointment}
              verifiedPatientId={verifiedPatient.id}
              onComplete={handleAppointmentManaged}
              onCancel={() => closeAllForms()}
            />
          )}

          {activeForm === 'family-registration' && (patientInfo || verifiedPatient) && (
            <FamilyRegistration
              primaryPatientId={verifiedPatient.id}
              onComplete={handleFamilyRegistrationComplete}
              onCancel={() => closeAllForms()}
            />
          )}

          {activeForm === 'family-scheduler' && (patientInfo || verifiedPatient) && verifiedPatient && (
            <FamilyScheduler
              primaryPatientId={verifiedPatient.id}
              familyMembers={familyMembers}
              onScheduled={handleFamilyAppointmentsScheduled}
              onCancel={() => closeAllForms()}
              verifiedPatient={verifiedPatient}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default App;