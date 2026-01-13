# Troubleshooting: Questions Not Asked & Results Not Saved

## Issue 1: Questions Not Being Asked

### Problem
The AI assistant is not asking the questions that were generated and saved in Google Sheets.

### Root Causes & Solutions

#### 1. Assistant Prompt Missing `{{customQuestions}}` Variable

**Problem**: The Vapi assistant prompt doesn't include the `{{customQuestions}}` variable, so it can't access the questions.

**Solution**:
1. Go to [Vapi Dashboard](https://dashboard.vapi.ai) → Assistants → Your Assistant
2. Edit the **System Prompt**
3. Add `{{customQuestions}}` in the prompt. Example:

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
5. If no custom questions provided ({{customQuestions}} is empty), generate 5 relevant questions for the subject

Your Behavior:
1. Start with a warm greeting and brief introduction
2. Ask the provided questions (or generate 5 if none provided)
3. After each question, wait for the student's complete answer
4. If student gives incomplete answer, ask ONE follow-up to probe deeper
5. If student says "I don't know", acknowledge it and move to next question
6. After all questions are answered, thank the student and end the call

End the call by saying: "Thank you for completing this viva. You may now end the session."
```

4. **Save** the assistant

#### 2. Questions Not Found in Google Sheets

**Check**:
1. Open your Google Sheet
2. Verify there's a sheet named **"Viva Questions"** (exact name, case-sensitive)
3. Check the sheet has these columns:
   - Column A: Subject
   - Column B: Topics
   - Column C: Question
   - Column D: Expected Answer
   - Column E: Difficulty
   - Column F: Created At
   - Column G: Active (must be "TRUE" for questions to be used)

4. Verify:
   - Subject name matches exactly (case-insensitive)
   - Active column is set to "TRUE"
   - Questions exist for the subject you're testing

**Test the API**:
```bash
# Replace with your actual domain and subject
curl "http://localhost:3000/api/get-questions?subject=Data%20Structures"
```

Should return JSON with `success: true` and a `questions` array.

#### 3. Questions Not Being Passed to Vapi

**Check Browser Console**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for logs starting with `[VapiSession]`:
   - `[VapiSession] Found X custom questions` - Questions were found
   - `[VapiSession] No custom questions found` - Questions not found
   - `[VapiSession] Questions preview: ...` - Shows formatted questions

**If questions are found but not asked**:
- Verify the assistant prompt includes `{{customQuestions}}`
- Check that variableValues are being passed correctly (see console logs)

---

## Issue 2: Results Not Being Saved to Google Sheets

### Problem
Viva results are not appearing in the "Viva Results" sheet in Google Sheets.

### Root Causes & Solutions

#### 1. Webhook Not Receiving Events

**Check**:
1. Verify webhook URL in Vapi Dashboard:
   - Go to Assistant settings → Webhooks
   - URL should be: `https://your-domain.com/api/viva-complete`
   - For local development with ngrok: `https://your-ngrok-url.ngrok.io/api/viva-complete`
   - Events subscribed: `end-of-call-report` (required)

2. **Test webhook endpoint**:
```bash
# Test if endpoint is accessible
curl -X GET https://your-domain.com/api/viva-complete
# Should return: {"status":"ok","endpoint":"/api/viva-complete",...}
```

3. **Check server logs** for webhook calls:
   - Look for: `[Viva Complete] ===== WEBHOOK RECEIVED =====`
   - If not seeing this, webhook is not configured correctly

#### 2. Google Sheets Configuration Issues

**Check Environment Variables**:
```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CLIENT_EMAIL="your-service-account@project.iam.gserviceaccount.com"
GOOGLE_SHEET_ID="your-google-sheet-id"
```

**Verify**:
1. Private key is properly formatted with `\n` for newlines
2. Service account email is correct
3. Sheet ID is correct (from Google Sheets URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`)

**Check Service Account Permissions**:
1. Open your Google Sheet
2. Click **Share** button
3. Add the service account email (from `GOOGLE_CLIENT_EMAIL`)
4. Give it **Editor** access (not just Viewer)

#### 3. Sheet Name Mismatch

**Check**:
- The sheet tab must be named exactly: **"Viva Results"** (case-sensitive)
- If it has a different name, either:
  - Rename the sheet tab to "Viva Results", OR
  - Update `SHEET_NAME` constant in `lib/utils/sheets.ts`

#### 4. Webhook Processing Errors

**Check Server Logs** for errors:
- `[Viva Complete] Failed to save to sheets:` - Sheets save failed
- `[Sheets] Error saving to Google Sheets:` - Detailed error message
- `[Viva Complete] No Q&A pairs found in transcript` - Can't evaluate without Q&A pairs

**Common Errors**:
- `invalid_grant` - Private key or client email is wrong
- `not found` - Sheet ID is wrong or service account doesn't have access
- `permission denied` - Service account needs Editor access

#### 5. No Transcript / Q&A Pairs

**If webhook receives but can't process**:
- Check logs for: `[Viva Complete] No Q&A pairs extracted from transcript!`
- This means the transcript doesn't have proper Q&A format
- The assistant might not be asking questions properly (see Issue 1)

---

## Quick Diagnostic Checklist

### For Questions Not Being Asked:
- [ ] Assistant prompt includes `{{customQuestions}}`
- [ ] "Viva Questions" sheet exists in Google Sheets
- [ ] Questions have `Active = TRUE` in column G
- [ ] Subject name matches exactly
- [ ] Browser console shows questions being fetched
- [ ] `variableValues.customQuestions` is passed to Vapi (check console logs)

### For Results Not Being Saved:
- [ ] Webhook URL is configured in Vapi Dashboard
- [ ] Webhook endpoint is accessible (test with curl)
- [ ] Server logs show `[Viva Complete] ===== WEBHOOK RECEIVED =====`
- [ ] Google Sheets credentials are correct in `.env`
- [ ] Service account has Editor access to the sheet
- [ ] Sheet tab is named "Viva Results"
- [ ] Server logs show `[Viva Complete] ✓ Successfully saved to Google Sheets`
- [ ] Transcript has Q&A pairs (check logs)

---

## Testing Steps

1. **Test Question Fetching**:
   ```bash
   curl "http://localhost:3000/api/get-questions?subject=YourSubject"
   ```

2. **Test Webhook Endpoint**:
   ```bash
   curl -X GET "http://localhost:3000/api/viva-complete"
   ```

3. **Start a Viva**:
   - Fill in student details
   - Select subject that has questions in Google Sheets
   - Start the viva
   - Check browser console for `[VapiSession]` logs
   - Check server logs for `[Viva Complete]` logs

4. **Verify Results**:
   - After viva ends, check Google Sheets "Viva Results" tab
   - Should see a new row with the viva data
   - Check server logs for any errors

---

## Still Having Issues?

1. **Check Server Logs**: Look for error messages starting with `[Viva Complete]` or `[Sheets]`
2. **Check Browser Console**: Look for `[VapiSession]` logs
3. **Verify Vapi Dashboard**: Assistant settings, webhook configuration
4. **Test Manually**: Use curl to test API endpoints
5. **Check Google Sheets**: Verify sheet structure and permissions
