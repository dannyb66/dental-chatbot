# Dental Assistant Chatbot - Technical Documentation

## Architecture Overview

### System Architecture
```
├── Frontend (React + TypeScript)
│   ├── Authentication Layer (Supabase Auth)
│   ├── Chat Interface
│   │   ├── Message Processing
│   │   ├── Context Management
│   │   └── Response Generation
│   ├── Appointment Management
│   │   ├── Individual Scheduling
│   │   ├── Family Scheduling
│   │   └── Emergency Handling
│   ├── Patient Management
│   │   ├── Registration
│   │   ├── Family Members
│   │   └── Verification
│   └── Practice Information
│
├── Backend (Supabase)
│   ├── Database (PostgreSQL)
│   │   ├── Patient Records
│   │   ├── Appointments
│   │   ├── Family Relationships
│   │   └── Available Slots
│   ├── Authentication
│   ├── Row Level Security
│   └── Real-time Subscriptions
│
└── AI Integration (Google Gemini)
    ├── Natural Language Processing
    ├── Context Management
    ├── Intent Recognition
    └── Response Generation
```

## Technologies Used

### Frontend
- **React 18.3.1**: Core UI framework
- **TypeScript**: Type safety and development efficiency
- **Tailwind CSS**: Utility-first styling
- **date-fns**: Date manipulation and formatting
- **UUID**: Unique identifier generation
- **Lucide React**: Icon system

### Backend
- **Supabase**: Backend-as-a-Service platform
  - PostgreSQL database
  - Authentication system
  - Row Level Security (RLS)
  - Real-time subscriptions

### AI/ML
- **Google Gemini AI**: Natural language processing
  - Context-aware responses
  - Intent recognition
  - Conversation flow management

### Development Tools
- **Vite**: Build tool and development server
- **ESLint**: Code quality and consistency
- **PostCSS**: CSS processing
- **Autoprefixer**: CSS compatibility

## Database Schema

### Tables
1. **patients**
   - Primary patient information
   - Family relationship tracking
   - User authentication links

2. **family_relationships**
   - Tracks relationships between patients
   - Manages family member connections
   - Enables coordinated scheduling

3. **appointments**
   - Appointment scheduling
   - Family group tracking
   - Status management

4. **available_slots**
   - Time slot management
   - Availability tracking
   - Conflict prevention

5. **appointment_types**
   - Different appointment categories
   - Duration management
   - Service types

## Security Implementation

### Row Level Security
- Patient data isolation
- Family access controls
- Appointment management restrictions

### Authentication Flow
- Email/password authentication
- Session management
- Secure token handling

### Data Protection
- Encrypted transmission
- Secure storage
- Access control

## Feature Implementation

### Family Scheduling
```typescript
// Example family scheduling logic
interface FamilyAppointment {
  patientId: string;
  appointmentTypeId: string;
  slotId: string;
  familyGroupId: string;
}

async function bookFamilyAppointments(appointments: FamilyAppointment[]) {
  const familyGroupId = generateUUID();
  
  for (const appointment of appointments) {
    await bookAppointment({
      ...appointment,
      familyGroupId
    });
  }
}
```

### Appointment Management
```typescript
// Example appointment coordination
async function findConsecutiveSlots(date: Date, count: number) {
  const slots = await getAvailableSlots(date);
  return findConsecutiveAvailableSlots(slots, count);
}
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Google Cloud account (for Gemini API)

### Environment Variables
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### Installation Steps
```bash
# Clone repository
git clone [repository_url]
cd dental-assistant-chat

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Start development server
npm run dev
```

## Deployment

### Build Process
```bash
# Production build
npm run build

# Preview build
npm run preview
```

### Database Migrations
- Located in `supabase/migrations`
- Contains:
  - Table creation
  - RLS policies
  - Indexes
  - Stored procedures

## Testing

### Unit Tests
- Component testing
- Utility function testing
- AI response testing

### Integration Tests
- API endpoint testing
- Database operation testing
- Authentication flow testing

### End-to-End Tests
- User flow testing
- Appointment scheduling
- Family management

## Maintenance

### Monitoring
- Error tracking
- Performance metrics
- Usage analytics

### Backup
- Database backups
- Configuration backups
- Recovery procedures

## Future Enhancements

### Planned Features
- Video consultation integration
- Advanced AI capabilities
- Mobile application
- Payment processing

### Scalability
- Load balancing
- Caching strategies
- Performance optimization