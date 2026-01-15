# Quick Test Guide - Verify VAPI Results Are Saving

## Quick Test (3 Steps)

### Step 1: Start Your Server
```bash
cd ai-viva-main
npm run dev
```

Wait for: `✓ Ready in X seconds`

### Step 2: Run the Test
In a **new terminal window**, run:
```bash
cd ai-viva-main
node scripts/test-webhook.js
```

### Step 3: Check Results

**In the test output, look for:**
- ✅ `"sheetsSaved": true` - Results were saved!
- ✅ `"success": true` - Webhook processed successfully

**In your server logs, look for:**
- `[Sheets] ✓ Successfully saved to Google Sheets!`
- `Updated rows: 1`

**In Google Sheets:**
1. Open your Google Sheet (from `GOOGLE_SHEET_ID`)
2. Check the **"Viva Results"** tab
3. You should see a new row with test data

## Alternative: Test via Browser

1. Start server: `npm run dev`
2. Open browser: `http://localhost:3000/api/test-vapi-webhook`
3. You'll see usage instructions
4. Use a tool like Postman or curl to POST to that endpoint

## What to Check If It Fails

### Check Environment Variables
```bash
# Make sure these are set in .env or .env.local:
GOOGLE_PRIVATE_KEY=...
GOOGLE_CLIENT_EMAIL=...
GOOGLE_SHEET_ID=...
```

### Check Google Sheets Permissions
1. Open your Google Sheet
2. Click "Share" button
3. Add the email from `GOOGLE_CLIENT_EMAIL`
4. Give it "Editor" access

### Check Server Logs
Look for error messages starting with:
- `[Sheets] ✗` - Sheet saving errors
- `[Test Webhook]` - Test endpoint errors
- `[Viva Complete]` - Webhook processing errors

## Expected Success Output

```
🧪 Testing VAPI Webhook Endpoint
==================================================
Webhook URL: http://localhost:3000/api/test-vapi-webhook
...

📥 Response Status: 200 OK
Response Body: {
  "success": true,
  "sheetsSaved": true,
  "evaluation": {
    "totalMarks": 6,
    "maxTotalMarks": 9,
    "percentage": 66.67
  }
}

✅ Webhook processed successfully!
✅ Results saved to Google Sheets!
```

## Testing with Real VAPI Calls

Once the test endpoint works, your real VAPI webhooks will also work because they use the same code path.

The main difference:
- Test endpoint: `/api/test-vapi-webhook` (simpler, for testing)
- Real VAPI: `/api/viva-complete` (handles VAPI's webhook format)

Both save to the same Google Sheet!
