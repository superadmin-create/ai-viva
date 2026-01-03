# AI Viva

AI-powered viva examination system built with Next.js 14.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Shadcn UI components
- Vapi AI (Voice AI SDK)

## Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Copy environment variables:
\`\`\`bash
cp .env.example .env
\`\`\`

3. Configure Resend API (for OTP emails):
   - Sign up at [Resend](https://resend.com)
   - Get your API key from [Resend API Keys](https://resend.com/api-keys)
   - Add your API key to `.env`:
   \`\`\`
   RESEND_API_KEY=your_resend_api_key_here
   \`\`\`
   - Optionally set a custom from email (requires verified domain):
   \`\`\`
   RESEND_FROM_EMAIL=AI Viva <noreply@yourdomain.com>
   \`\`\`

4. Configure Vapi (for voice conversations):
   - Sign up at [Vapi](https://vapi.ai)
   - Get your API keys from Vapi Dashboard
   - Create an assistant (see [VAPI_SETUP.md](./docs/VAPI_SETUP.md) for detailed instructions)
   - Add your keys to `.env`:
   \`\`\`
   NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key
   VAPI_PRIVATE_KEY=your_vapi_private_key
   NEXT_PUBLIC_VAPI_ASSISTANT_ID=your_assistant_id
   \`\`\`

5. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

**Note:** To ensure the server always runs on port 3000 and kills any existing processes, use:
\`\`\`bash
.\start-dev.ps1
\`\`\`

## Project Structure

- `/app` - Next.js App Router pages
- `/components` - React components
  - `/ui` - Shadcn UI components
  - `/forms` - Form components
  - `/viva` - Viva-related components
- `/lib` - Utility functions and API helpers
  - `/utils/otp-storage.ts` - In-memory OTP storage (use Redis in production)
  - `/utils/email-templates.ts` - Email templates for OTP
  - `/vapi/client.ts` - Vapi SDK client initialization
- `/api` - API route handlers
  - `/send-otp` - Generate and send OTP via email
  - `/verify-otp` - Verify OTP code
  - `/verify-student` - Verify student with Edmingle LMS
- `/components/viva` - Viva session components
  - `VapiSession.tsx` - Vapi voice session handler
  - `AudioVisualizer.tsx` - Audio visualization component
  - `Timer.tsx` - Session timer component
- `/docs` - Documentation
  - `VAPI_SETUP.md` - Vapi assistant configuration guide

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

