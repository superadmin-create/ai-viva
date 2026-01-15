# Debugging VAPI Webhook Issues

If responses are not being saved to Google Sheets, follow these steps to debug:

## Step 1: Check if Webhooks Are Reaching Your Server

### Option A: Use the Debug Endpoint

1. Temporarily change your VAPI webhook URL to: `https://your-app.com/api/webhook-debug`
2. Make a test call through VAPI
3. Check your server logs for `[Webhook Debug]` messages
4. This will show you exactly what format VAPI is sending

### Option B: Check Server Logs

Look for these log messages when a webhook arrives:
- `[Viva Complete] ===== WEBHOOK RECEIVED =====`
- `[Viva Complete] Payload keys:`
- `[Viva Complete] Message type:`

If you don't see these, webhooks aren't reaching your server.

## Step 2: Verify Webhook Format

Check your logs for:
```
[Viva Complete] Full payload structure: {
  "hasMessage": true/false,
  "hasCall": true/false,
  "messageType": "...",
  "callStatus": "...",
  "hasTranscript": true/false
}
```

This tells you:
- Where VAPI is putting the call data
- What message type they're sending
- Whether transcript is included

## Step 3: Check Processing Flow

Look for these log messages in order:

1. `[Viva Complete] Processing call completion` - Webhook is being processed
2. `[Viva Complete] Found X Q&A pairs` - Transcript was parsed
3. `[Viva Complete] Evaluation complete` - Evaluation was created
4. `[Viva Complete] ===== SAVING TO GOOGLE SHEETS =====` - Saving started
5. `[Sheets] ✓ Successfully saved to Google Sheets!` - Save succeeded

If any step is missing, that's where the issue is.

## Step 4: Check for Errors

Look for these error patterns:

### Error: "No call data to process"
- **Cause**: VAPI webhook doesn't have call object
- **Solution**: Check webhook format in logs, may need to adjust extraction logic

### Error: "Sheets configuration not found"
- **Cause**: Missing environment variables
- **Solution**: Set `GOOGLE_PRIVATE_KEY`, `GOOGLE_CLIENT_EMAIL`, `GOOGLE_SHEET_ID`

### Error: "Permission denied"
- **Cause**: Service account doesn't have access
- **Solution**: Share Google Sheet with service account email

### Error: "Spreadsheet not found"
- **Cause**: Wrong sheet ID
- **Solution**: Verify `GOOGLE_SHEET_ID` is correct

## Step 5: Test with Test Endpoint

Run the test endpoint to verify saving works:
```bash
node scripts/test-webhook.js
```

If this works but real VAPI webhooks don't, the issue is with webhook format/processing.

## Common Issues

### Issue: Webhooks arrive but nothing is saved

**Check:**
1. Are you seeing `[Viva Complete] Processing call completion`?
2. Are you seeing `[Viva Complete] ===== SAVING TO GOOGLE SHEETS =====`?
3. What's the last log message before it stops?

**Possible causes:**
- Webhook format doesn't match what we expect
- Early return before reaching save function
- Error during save that's being caught

### Issue: "No call data to process"

**Check logs for:**
- `[Viva Complete] Full payload structure:`
- `[Viva Complete] Has call: false`

**Solution:**
- VAPI might be sending webhooks in a different format
- Use `/api/webhook-debug` to see exact format
- May need to update call extraction logic

### Issue: Webhooks not arriving

**Check:**
1. Is your webhook URL correct in VAPI dashboard?
2. Is your server accessible from the internet? (use ngrok for local dev)
3. Are webhooks enabled in VAPI dashboard?
4. Check VAPI dashboard for webhook delivery status

## Getting Help

When reporting issues, include:
1. Full server logs from webhook receipt to end
2. Output from `/api/webhook-debug` endpoint
3. Environment variables (redact sensitive values)
4. VAPI webhook configuration screenshot

## Quick Checklist

- [ ] Webhooks are reaching server (see logs)
- [ ] Call data is being extracted (check logs)
- [ ] Transcript is present (check logs)
- [ ] Evaluation is being created (check logs)
- [ ] Save function is being called (check logs)
- [ ] Google Sheets credentials are set
- [ ] Service account has sheet access
- [ ] Sheet ID is correct
