# Testing VAPI Webhook and Google Sheets Integration

This guide explains how to test if VAPI webhook responses are being saved to Google Sheets.

## Prerequisites

1. **Environment Variables Set**:
   - `GOOGLE_PRIVATE_KEY` - Service account private key
   - `GOOGLE_CLIENT_EMAIL` - Service account email
   - `GOOGLE_SHEET_ID` - Google Sheet ID
   - `ANTHROPIC_API_KEY` - (Optional) For AI evaluation

2. **Server Running**:
   - Start your Next.js development server: `npm run dev`
   - Server should be accessible at `http://localhost:3000` (or your configured port)

3. **Google Sheets Access**:
   - The service account email must have Editor access to the Google Sheet
   - The sheet should exist (it will be created automatically if it doesn't)

## Method 1: Using the Test Endpoint (Recommended)

The easiest way to test is using the built-in test endpoint.

### Step 1: Start your server
```bash
npm run dev
```

### Step 2: Test using curl
```bash
curl -X POST http://localhost:3000/api/test-vapi-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test Student",
    "subject": "Data Structures",
    "topics": "Arrays, Linked Lists, Trees"
  }'
```

### Step 3: Test using the Node.js script
```bash
node scripts/test-webhook.js
```

Or with custom data:
```bash
node scripts/test-webhook.js --email "student@test.com" --name "John Doe" --subject "Algorithms"
```

### Step 4: Check the response
You should see:
- ✅ `"success": true`
- ✅ `"sheetsSaved": true`
- Evaluation summary with marks and percentage

### Step 5: Verify in Google Sheets
1. Open your Google Sheet
2. Check the "Viva Results" tab
3. You should see a new row with:
   - Date & Time
   - Student Name
   - Email
   - Subject
   - Topics
   - Questions Answered
   - Score (out of 100)
   - Overall Feedback
   - Transcript
   - Recording URL
   - Evaluation (JSON)

## Method 2: Using Browser/Postman

1. Open your browser or Postman
2. Make a POST request to: `http://localhost:3000/api/test-vapi-webhook`
3. Set Content-Type: `application/json`
4. Body:
```json
{
  "email": "test@example.com",
  "name": "Test Student",
  "subject": "Data Structures",
  "topics": "Arrays, Linked Lists"
}
```

## Method 3: Testing with Real VAPI Webhook

If you want to test with an actual VAPI webhook:

1. **Set up ngrok** (for local testing):
   ```bash
   ngrok http 3000
   ```

2. **Configure VAPI Webhook**:
   - Go to VAPI Dashboard > Your Assistant > Webhooks
   - Set webhook URL to: `https://your-ngrok-url.ngrok.io/api/viva-complete`
   - Subscribe to: `end-of-call-report`

3. **Make a test call** through VAPI
   - The webhook will be triggered automatically when the call ends
   - Check your server logs for processing details

## Troubleshooting

### Issue: "Sheets configuration not found"
**Solution**: Check that all Google Sheets environment variables are set:
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_SHEET_ID`

### Issue: "Permission denied"
**Solution**: 
1. Open your Google Sheet
2. Click "Share"
3. Add the service account email (from `GOOGLE_CLIENT_EMAIL`)
4. Give it "Editor" access

### Issue: "Spreadsheet not found"
**Solution**: 
- Verify `GOOGLE_SHEET_ID` is correct
- Extract the ID from the Google Sheet URL:
  - URL format: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
  - Use only the `SHEET_ID` part

### Issue: "Authentication failed"
**Solution**:
- Check that `GOOGLE_PRIVATE_KEY` is correctly formatted
- Ensure newlines are preserved (use `\n` in .env files)
- Verify the private key hasn't expired

### Issue: Results not appearing in sheets
**Check**:
1. Server logs for error messages
2. That the "Viva Results" tab exists (it should be created automatically)
3. That the service account has write permissions
4. That environment variables are loaded correctly

## Checking Server Logs

When you run the test, check your server console for:
- `[Test Webhook]` or `[Viva Complete]` log messages
- `[Sheets]` log messages showing the save process
- Any error messages with details

Look for:
- ✅ `Successfully saved to Google Sheets`
- ✅ `Updated rows: 1`
- ❌ Any error messages indicating what went wrong

## Expected Log Output

Successful test should show:
```
[Test Webhook] ===== TEST WEBHOOK CALLED =====
[Test Webhook] Parsing transcript...
[Test Webhook] Found 3 Q&A pairs
[Test Webhook] Evaluation complete: 6/9 (66.67%)
[Test Webhook] Saving to Google Sheets...
[Sheets] ===== Starting save to Google Sheets =====
[Sheets] ✓ Authentication successful
[Sheets] ✓ Spreadsheet found
[Sheets] ✓ Headers verified/created
[Sheets] ✓ Successfully saved to Google Sheets!
```

## Next Steps

After successful testing:
1. Verify the data in Google Sheets matches what was sent
2. Check that evaluation JSON is properly formatted
3. Test with different student data to ensure it works consistently
4. Monitor logs during actual VAPI calls to ensure they're being saved
