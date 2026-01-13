# AI Viva System Test Results

## Test Checklist

### ✅ Server Status
- [ ] Server running on port 3000
- [ ] Webhook endpoint accessible (`/api/viva-complete`)
- [ ] Questions API accessible (`/api/get-questions`)

### ✅ Configuration
- [ ] `.env` file exists
- [ ] `NEXT_PUBLIC_VAPI_PUBLIC_KEY` set
- [ ] `VAPI_PRIVATE_KEY` set
- [ ] `NEXT_PUBLIC_VAPI_ASSISTANT_ID` set
- [ ] `GOOGLE_PRIVATE_KEY` set
- [ ] `GOOGLE_CLIENT_EMAIL` set
- [ ] `GOOGLE_SHEET_ID` set
- [ ] `VAPI_WEBHOOK_SECRET` set (optional)

### ✅ Google Sheets
- [ ] "Viva Questions" sheet exists
- [ ] "Viva Results" sheet exists
- [ ] Service account has Editor access
- [ ] Questions can be fetched via API

### ✅ Vapi Configuration
- [ ] Assistant created in Vapi Dashboard
- [ ] Webhook URL configured: `https://your-domain.com/api/viva-complete`
- [ ] Webhook subscribed to `end-of-call-report` event
- [ ] Assistant prompt includes `{{customQuestions}}` variable
- [ ] Assistant prompt includes instructions to ask questions one at a time

## Manual Testing Steps

### 1. Test Question Fetching
```bash
curl "http://localhost:3000/api/get-questions?subject=YourSubject"
```

Expected: JSON response with `success: true` and `questions` array

### 2. Test Webhook Endpoint
```bash
curl http://localhost:3000/api/viva-complete
```

Expected: `{"status":"ok","endpoint":"/api/viva-complete",...}`

### 3. Test Viva Session
1. Open browser to `http://localhost:3000`
2. Fill in student details
3. Select a subject that has questions in Google Sheets
4. Start the viva
5. Check browser console for:
   - `[VapiSession] ✓ Found X custom questions`
   - `[VapiSession] Questions preview: ...`
6. Check server logs for:
   - `[Viva Complete] ===== WEBHOOK RECEIVED =====`
   - `[Viva Complete] ✓ Successfully saved to Google Sheets`

### 4. Verify Results in Google Sheets
1. Open Google Sheets
2. Go to "Viva Results" tab
3. Verify new row appears after viva completes
4. Check that evaluation data is in column K

## Common Issues & Solutions

### Server Not Running
**Solution**: Run `npm run dev` in the `ai-viva-main` directory

### Questions Not Being Asked
**Check**:
1. Vapi assistant prompt includes `{{customQuestions}}`
2. Questions exist in "Viva Questions" sheet
3. Subject name matches exactly
4. Active column = "TRUE"

### Results Not Being Saved
**Check**:
1. Webhook URL is configured in Vapi Dashboard
2. Google Sheets credentials are correct
3. Service account has Editor access
4. Sheet tab is named "Viva Results" (exact match)
5. Server logs show webhook received

## Next Steps After Testing

1. ✅ Fix any configuration issues found
2. ✅ Update Vapi assistant prompt if needed
3. ✅ Test a complete viva session
4. ✅ Verify results appear in Google Sheets
5. ✅ Check admin panel shows evaluation data
