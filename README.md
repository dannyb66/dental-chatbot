# Dental Assistant Chatbot

A sophisticated web application that streamlines dental appointment management through an intuitive conversational interface. Built with React, TypeScript, and powered by Google's Gemini AI.

## Features

### Intelligent Chat Interface
- Natural language processing using Google's Gemini AI
- Context-aware responses based on patient history
- Support for both casual and formal communication
- Smart intent recognition

### Family Appointment Management
- Add and manage multiple family members
- Schedule back-to-back appointments
- Coordinate timing for family visits
- Group appointment management

### Smart Scheduling
- Real-time availability checking
- Multiple appointment types
- Emergency appointment handling
- Automatic time slot management
- Conflict prevention

### Practice Information
- Insurance coverage details
- Payment options
- Operating hours
- Location information

## Tech Stack

### Frontend
- React 18.3.1
- TypeScript
- Tailwind CSS
- date-fns
- Lucide React icons

### Backend
- Supabase
  - PostgreSQL database
  - Authentication
  - Row Level Security
  - Real-time subscriptions

### AI Integration
- Google Gemini AI
  - Natural language processing
  - Context management
  - Intent recognition

## Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Google Cloud account (for Gemini API)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd dental-assistant-chat
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

4. Start the development server:
```bash
npm run dev
```

## Environment Setup

### Supabase Configuration

1. Create a new Supabase project
2. Set up the following tables:
   - patients
   - appointments
   - family_relationships
   - available_slots
   - appointment_types

3. Enable Row Level Security (RLS) policies
4. Set up authentication

### Google Gemini AI Setup

1. Create a Google Cloud project
2. Enable the Gemini AI API
3. Generate an API key
4. Add the API key to your `.env` file

## Project Structure

```
├── src/
│   ├── components/         # React components
│   ├── lib/               # Utility functions and API calls
│   ├── types/             # TypeScript type definitions
│   └── App.tsx            # Main application component
├── docs/                  # Documentation
├── supabase/             # Supabase migrations and config
└── public/               # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Database Schema

### Tables

1. `patients`
   - Primary patient information
   - Family relationship tracking
   - User authentication links

2. `family_relationships`
   - Tracks relationships between patients
   - Manages family member connections

3. `appointments`
   - Appointment scheduling
   - Family group tracking
   - Status management

4. `available_slots`
   - Time slot management
   - Availability tracking

5. `appointment_types`
   - Different appointment categories
   - Duration management

## Security

- Row Level Security (RLS) policies
- Secure authentication
- Data encryption
- Access control

## Operating Hours

- Monday-Saturday: 8:00 AM - 6:00 PM
- Sunday: Closed
- Emergency appointments during business hours

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
