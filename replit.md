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

## Recent Changes
- January 2026: Configured for Replit environment (port 5000, allowedDevOrigins)
