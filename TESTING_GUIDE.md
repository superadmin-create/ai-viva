# AI Viva System Testing Guide

## Quick Test Commands

### 1. Check if Server is Running
```powershell
# Check if port 3000 is in use
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

# Or test the endpoint
Invoke-WebRequest -Uri "http://localhost:3000" -Method GET
```

### 2. Test Webhook Endpoint
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/viva-complete" -Method GET
```

**Expected Response:**
```json
{
  "status": "ok",
  "endpoint": "/api/viva-complete",
  "message": "Viva completion webhook endpoint is active"
}
```

### 3. Test Questions API
```powershell
# Test with a subject
Invoke-WebRequest -Uri "http://localhost:3000/api/get-questions?subject=Data%20Structures" -Method GET

# Or use curl
curl "http://localhost:3000/api/get-questions?subject=Data%20Structures"
```

**Expected Response:**
```json
{
  "success": true,
  "subject": "Data Structures",
  "questions": [...],
  "count": 5
}
```

### 4. Check Environment Variables
```powershell
cd ai-viva-main
if (Test-Path .env) {
    Write-Host "✓ .env file exists"
    Get-Content .env | Select-String -Pattern "VAPI|GOOGLE"
} else {
    Write-Host "✗ .env file NOT found"
}
```

## Manual Testing Checklist

### ✅ Pre-Test Setup
- [ ] Server is running (`npm run dev`)
- [ ] `.env` file exists with all required variables
- [ ] Google Sheets are accessible
- [ ] Vapi assistant is configured

### ✅ Test 1: Question Fetching
1. Open browser console (F12)
2. Navigate to viva page
3. Select a subject that has questions
4. Check console for: `[VapiSession] ✓ Found X custom questions`

**If questions not found:**
- Check "Viva Questions" sheet exists
- Verify subject name matches exactly
- Check Active column = "TRUE"

### ✅ Test 2: Viva Session
1. Fill in student details
2. Select subject
3. Click "Start Viva"
4. Verify AI asks questions (not just generates them)
5. Complete the viva

**Check browser console for:**
- `[VapiSession] Questions preview: ...`
- `[VapiSession] Call start initiated with custom questions`

### ✅ Test 3: Results Saving
1. After viva ends, check server logs
2. Look for: `[Viva Complete] ===== WEBHOOK RECEIVED =====`
3. Look for: `[Viva Complete] ✓ Successfully saved to Google Sheets`

**If not saving:**
- Check webhook URL in Vapi Dashboard
- Verify Google Sheets credentials
- Check service account has Editor access
- Verify sheet tab is named "Viva Results"

### ✅ Test 4: Admin Panel
1. Open admin panel
2. Go to Results page
3. Verify new viva appears
4. Click to view details
5. Check evaluation data shows per-question breakdown

## Common Issues

### Server Won't Start
**Check:**
- Port 3000 is not in use: `Get-NetTCPConnection -LocalPort 3000`
- Kill existing process: `Stop-Process -Id <PID> -Force`
- Check for errors in terminal

### Questions Not Being Asked
**Check:**
1. Vapi Dashboard → Assistant → System Prompt
2. Must include: `{{customQuestions}}`
3. Must have instructions to ask questions one at a time

### Results Not Saving
**Check:**
1. Vapi Dashboard → Assistant → Webhooks
2. URL: `https://your-domain.com/api/viva-complete`
3. Event: `end-of-call-report`
4. Google Sheets service account has Editor access

## Test Results Template

```
Date: ___________
Tester: ___________

Server Status: [ ] Running [ ] Not Running
Webhook Endpoint: [ ] Accessible [ ] Not Accessible
Questions API: [ ] Working [ ] Not Working
Environment Variables: [ ] All Set [ ] Missing
Google Sheets: [ ] Accessible [ ] Not Accessible
Vapi Configuration: [ ] Complete [ ] Incomplete

Questions Being Asked: [ ] Yes [ ] No
Results Being Saved: [ ] Yes [ ] No
Evaluation Data Visible: [ ] Yes [ ] No

Issues Found:
1. ________________________________
2. ________________________________
3. ________________________________
```

## Next Steps

After testing, if issues are found:
1. Review `TROUBLESHOOTING_VIVA_ISSUES.md`
2. Check server logs for error messages
3. Verify Vapi Dashboard configuration
4. Test individual components separately
