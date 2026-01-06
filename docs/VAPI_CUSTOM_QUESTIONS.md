# Using Teacher-Defined Questions in AI Viva

## Overview

The AI Viva system now supports **teacher-defined questions** from the Admin Panel. Teachers can generate questions using the Viva Generator, save them to Google Sheets, and the AI will use those specific questions during the viva.

## How It Works

```
┌─────────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Admin Panel       │────▶│  Google Sheets   │◀────│   AI Viva App   │
│  (Viva Generator)   │     │ "Viva Questions" │     │  (VAPI Session) │
└─────────────────────┘     └──────────────────┘     └─────────────────┘
         │                          │                        │
         │ Saves questions          │ Stores by subject      │ Fetches questions
         │ with subject             │ - Question             │ before starting
         │                          │ - Expected Answer      │ viva call
         └──────────────────────────┴────────────────────────┘
```

## Setup Steps

### 1. Update Your VAPI Assistant Prompt

Go to [Vapi Dashboard](https://dashboard.vapi.ai) and update your assistant's system prompt to include `{{customQuestions}}`:

```
You are an AI Viva Examiner conducting an oral examination for a student.

Student Info:
- Name: {{studentName}}
- Subject: {{subject}}
- Topics: {{topics}}

QUESTIONS TO ASK:
{{customQuestions}}

CRITICAL RULES - FOLLOW THESE STRICTLY:

1. Use the provided questions above if available
2. Ask ONLY ONE question at a time
3. After asking a question, you MUST WAIT for the student's complete answer
4. Do NOT ask the next question until the student has finished answering
5. If no custom questions provided, generate 5 relevant questions for the subject

Your Behavior:
1. Start with a warm greeting and brief introduction
2. Ask the provided questions (or generate 5 if none provided)
3. After each question, wait for the student's complete answer
4. If student gives incomplete answer, ask ONE follow-up to probe deeper
5. If student says "I don't know", acknowledge it and move to next question
6. After all questions are answered, thank the student and end the call

Evaluation (track internally):
- For each answer, compare with the expected answer if provided
- Note: 0 (no answer), 1 (partial), 2 (good), 3 (excellent)

End the call by saying: "Thank you for completing this viva. You may now end the session."
```

### 2. Generate Questions in Admin Panel

1. Go to Admin Panel → **Viva Generator**
2. Select input mode:
   - **Topic Only**: Enter subject and topics
   - **Upload File**: Upload study material (PDF/TXT)
   - **Paste Text**: Paste educational content
3. Configure difficulty level
4. Click **Generate Viva Questions**
5. Review the generated questions
6. Click **"Save for AI Viva"** button

### 3. Verify Questions are Saved

In Google Sheets, a new sheet called **"Viva Questions"** will contain:

| Subject | Topics | Question | Expected Answer | Difficulty | Created At | Active |
|---------|--------|----------|-----------------|------------|------------|--------|
| Data Structures | Binary Trees, Sorting | What is a binary tree? | A binary tree is... | easy | 2026-01-05 | TRUE |

### 4. Test the Integration

1. Start a viva in the AI Viva app
2. Select the same subject that has saved questions
3. The AI will now ask your custom questions!

## Managing Questions

### Deactivating Questions
Set the "Active" column to "FALSE" in Google Sheets to exclude a question.

### Updating Questions
- Generate new questions in Admin Panel
- Old questions remain but can be deactivated
- Or delete rows directly in Google Sheets

### Multiple Question Sets
You can have multiple question sets per subject. The AI will use all active questions for that subject.

## Troubleshooting

### AI not using custom questions?

1. **Check Google Sheets**: Verify questions are in "Viva Questions" sheet
2. **Check Subject Match**: Subject in viva must match subject in questions (case-insensitive)
3. **Check Active Status**: Questions must have "TRUE" in Active column
4. **Check VAPI Prompt**: Ensure `{{customQuestions}}` is in your assistant's prompt
5. **Check Console**: Look for "[VapiSession] Found X custom questions" log

### Questions not saving?

1. Verify Google Sheets credentials are configured in Admin Panel `.env.local`
2. Check that the service account has write access to the spreadsheet
3. Look for errors in browser console or server logs

## Environment Variables

Both `ai-viva-main` and `admin_panel` need these in `.env.local`:

```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SHEET_ID=your-google-sheet-id
```

These should be the **same credentials** so both apps access the same Google Sheet.


