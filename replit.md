# AI Viva - Student Registration System

## Overview
AI Viva is a Next.js 14 application for student registration. It integrates with:
- Edmingle LMS API for student management
- Google Sheets for data storage
- VAPI for voice AI functionality
- Resend for email notifications

## Project Structure
```
app/              # Next.js App Router pages and API routes
  api/            # API endpoints
  complete/       # Completion page
  verify/         # Verification page
  viva/           # Viva exam page
components/       # React components
lib/              # Utility libraries
public/           # Static assets
scripts/          # Build/dev scripts
docs/             # Documentation
```

## Setup
- **Framework**: Next.js 14.2.35
- **Port**: 5000 (development and production)
- **Host**: 0.0.0.0 for Replit compatibility

## Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server

## Environment Variables
Required (see .env.example):
- `EDMINGLE_API_KEY` - Edmingle LMS API key
- `EDMINGLE_BASE_URL` - Edmingle LMS base URL
- `RESEND_API_KEY` - Resend API key for emails
- `NEXT_PUBLIC_APP_URL` - Public app URL

## Data Storage
- **Google Sheets**: Primary storage for viva results (dual write)
- **Admin PostgreSQL Database** (Neon): External admin panel database (`ADMIN_DATABASE_URL` secret) with `viva_results` table for production data storage
- Both the `/api/viva-complete` webhook and `/api/sync-results` endpoint save to both Google Sheets and the admin database
- The admin database uses `vapi_call_id` as a deduplication key

## VAPI Webhook Data Flow
- VAPI sends evaluation data in `message.analysis.structuredData` (evaluation JSON, teacher_email, marks_breakdown)
- Both `/api/viva-complete` and `/api/sync-results` prioritize VAPI's structured data over local evaluation
- Falls back to local transcript parsing + evaluation if VAPI doesn't provide structured data
- Google Sheets columns: timestamp, callId, studentEmail, studentName, subject, topics, duration, totalMarks, maxTotalMarks, percentage, transcript, recordingUrl, evaluation, teacherEmail, marksBreakdown (A:O)

## Recent Changes
- February 17, 2026: Updated both endpoints to extract evaluation, teacher_email, marks_breakdown from VAPI's analysis.structuredData
- February 17, 2026: Added teacher_email and marks_breakdown columns to Google Sheets (columns N, O)
- February 2026: Added dual persistence to admin PostgreSQL database (lib/utils/admin-db.ts)
- February 2026: Updated sync-results and viva-complete endpoints to save to admin DB
- January 2026: Configured for Replit environment (port 5000, allowedDevOrigins)
