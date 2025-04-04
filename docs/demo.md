# Dental Assistant Chatbot - Demo Documentation

## Key Features Demonstration

### 1. Patient Registration and Verification
```typescript
// Example chat interaction
Bot: "Hello! I'm your dental assistant. How can I help you today?"
User: "I need to schedule an appointment"
Bot: "I'll need to verify your information first..."

// Verification format
User: "John Smith, 1234567890, 1990-01-01"
Bot: "Thank you for verifying your information..."
```

### 2. Family Member Management
```typescript
// Adding family members
Bot: "Would you like to add family members to your account?"
User: "Yes, I want to add my spouse and children"

// Component render
<FamilyRegistration
  primaryPatientId={verifiedPatient.id}
  onComplete={handleFamilyRegistrationComplete}
  onCancel={handleCancel}
/>
```

### 3. Family Appointment Scheduling
```typescript
// Scheduling flow for multiple family members
const handleFamilyScheduling = async () => {
  // Find consecutive slots
  const slots = await findConsecutiveSlots(date, familyMembers.length);
  
  // Book appointments
  await bookFamilyAppointments(appointments);
};

// Component render
<FamilyScheduler
  primaryPatientId={verifiedPatient.id}
  familyMembers={familyMembers}
  onScheduled={handleFamilyAppointmentsScheduled}
  onCancel={handleCancel}
/>
```

### 4. Emergency Handling
```typescript
// Emergency detection and handling
const emergencyKeywords = ['emergency', 'urgent', 'pain', 'severe'];
const isEmergency = emergencyKeywords.some(keyword => 
  message.toLowerCase().includes(keyword)
);

if (isEmergency) {
  // Priority scheduling
  // Immediate response
  // Staff notification
}
```

### 5. Practice Information Queries
```typescript
// Insurance information
Bot: "We accept all major dental insurance plans including:
- Delta Dental
- Cigna
- Aetna
- MetLife
- United Healthcare"

// Operating hours
Bot: "Our office hours are:
Monday-Saturday: 8:00 AM - 6:00 PM
Sunday: Closed"
```

## Technical Implementation

### 1. Chat Context Management
```typescript
interface ChatContext {
  isAuthenticated: boolean;
  patientName?: string;
  hasAppointments: boolean;
  isVerified: boolean;
  hasFamilyMembers: boolean;
}

const handleChatResponse = async (
  messages: Message[],
  context: ChatContext
) => {
  // Process message with context
  const response = await getChatResponse(messages, context);
  return response;
};
```

### 2. Family Scheduling Logic
```typescript
interface ConsecutiveSlots {
  slots: AvailableSlot[];
  validInitialSlots: AvailableSlot[];
}

const findConsecutiveSlots = async (
  date: Date,
  numSlots: number
): Promise<ConsecutiveSlots | null> => {
  // Find available consecutive slots
  // Return valid combinations
};
```

### 3. Appointment Management
```typescript
interface AppointmentGroup {
  primaryAppointment: Appointment;
  familyAppointments: Appointment[];
}

const manageFamilyAppointments = async (
  groupId: string
): Promise<AppointmentGroup> => {
  // Fetch all related appointments
  // Handle updates/cancellations
};
```

## Sample Interactions

### 1. Family Scheduling
```
User: "I need to schedule appointments for my family"

Bot: "I'll help you schedule appointments for your family. First, I'll need to verify your identity. Please provide your information in this format:
[Full Name], [10-digit phone], [YYYY-MM-DD]"

User: "John Smith, 1234567890, 1990-01-01"

Bot: "Thank you for verifying your information. I see you have the following family members registered:
- Sarah Smith (spouse)
- Tommy Smith (child)
Would you like to schedule appointments for them?"

User: "Yes, please"

[Family Scheduler Form appears]
```

### 2. Emergency Handling
```
User: "I have severe tooth pain"

Bot: "I understand this is an emergency. I'll help you schedule an urgent appointment. Please provide your information..."

[After verification]

Bot: "I've scheduled an emergency appointment for you today at [next available slot]. The dental office staff have been notified about your emergency."
```

### 3. Insurance Inquiries
```
User: "What insurance do you accept?"

Bot: "We accept all major dental insurance plans, including:
- Delta Dental
- Cigna
- Aetna
- MetLife
- United Healthcare
- BlueCross BlueShield

For patients without insurance, we offer:
- Flexible payment plans
- Membership plans for regular care
- CareCredit financing
- HSA/FSA acceptance"
```

## Testing Scenarios

### 1. Family Member Addition
```typescript
test('adding family member', async () => {
  const result = await addFamilyMember({
    primaryPatientId: 'test-id',
    fullName: 'Jane Smith',
    relationship: 'spouse',
    userId: 'primary-user-id'
  });
  
  expect(result).toHaveProperty('id');
  expect(result.relationship).toBe('spouse');
});
```

### 2. Consecutive Slot Finding
```typescript
test('finding consecutive slots', async () => {
  const slots = await findConsecutiveSlots(
    new Date(),
    3 // Number of family members
  );
  
  expect(slots).toHaveProperty('validInitialSlots');
  expect(slots.slots.length).toBe(3);
});
```

### 3. Emergency Priority
```typescript
test('emergency appointment priority', async () => {
  const result = await handleEmergencyAppointment({
    patientId: 'test-id',
    description: 'Severe tooth pain'
  });
  
  expect(result.priority).toBe('high');
  expect(result.notificationSent).toBe(true);
});
```