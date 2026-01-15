# Evaluation and Duplicate Save Fixes

## Issues Fixed

### 1. ✅ Duplicate Saves (4 times per evaluation)
**Problem:** Results were being saved 4 times per evaluation

**Root Cause:**
- VAPI sends multiple webhook events (status-update, transcript, end-of-call-report, etc.)
- All events were being processed, causing multiple saves

**Solution:**
- Added early return for non-end-of-call events
- Added deduplication check in `saveToSheets()` to check if call ID already exists
- Only process `end-of-call-report` messages or calls with status "ended"/"completed"

**Code Changes:**
- `app/api/viva-complete/route.ts`: Added check to skip non-end-of-call events
- `lib/utils/sheets.ts`: Added `callIdExists()` function to check for duplicates before saving

### 2. ✅ Evaluation Results Not Showing
**Problem:** Evaluation results were not being generated or saved properly

**Solution:**
- Ensured evaluation is always generated (even if Q&A pairs are empty)
- Added comprehensive validation and logging for evaluation data
- Enhanced evaluation summary logging to verify data before saving

**Code Changes:**
- Enhanced evaluation validation with detailed logging
- Added evaluation summary before saving to sheets
- Improved error handling to always create evaluation object

### 3. ✅ Save Evaluation JSON to File
**Problem:** Evaluation JSON was only saved to Google Sheets

**Solution:**
- Added file saving functionality to save evaluation JSON to `evaluations/` folder
- Each evaluation is saved as: `evaluation-{callId}-{timestamp}.json`
- Files are automatically created in `evaluations/` directory

**Code Changes:**
- Added file system operations to save evaluation JSON
- Created `evaluations/` directory automatically
- Added to `.gitignore` to prevent committing sensitive data

## Key Changes

### 1. Deduplication Logic
```typescript
// In sheets.ts
async function callIdExists(sheets, sheetId, callId): Promise<boolean> {
  // Checks if call ID already exists in sheet
  // Returns true if duplicate found
}

// Before saving, check for duplicates
const alreadyExists = await callIdExists(sheets, config.sheetId, row.callId);
if (alreadyExists) {
  return { success: true, error: "Call ID already exists - duplicate save prevented" };
}
```

### 2. Early Return for Non-End-of-Call Events
```typescript
// Only process end-of-call-report events
if (messageType && !isEndOfCall) {
  return NextResponse.json({ 
    received: true, 
    type: messageType, 
    note: "Not an end-of-call event, skipping processing" 
  });
}
```

### 3. Evaluation JSON File Saving
```typescript
// Save evaluation JSON to file
const evaluationsDir = join(process.cwd(), "evaluations");
await mkdir(evaluationsDir, { recursive: true });
const fileName = `evaluation-${callId}-${Date.now()}.json`;
await writeFile(join(evaluationsDir, fileName), evaluationJson, "utf-8");
```

### 4. Enhanced Evaluation Validation
```typescript
// Comprehensive validation before saving
console.log("[Viva Complete] Evaluation validation:", {
  hasEvaluation: !!evaluation,
  marksCount: evaluation?.marks?.length || 0,
  totalMarks: evaluation?.totalMarks || 0,
  percentage: evaluation?.percentage || 0,
  evaluationJsonLength: evaluationJson?.length || 0,
});
```

## What Gets Saved Now

### Google Sheets (Viva Results tab)
1. **Date & Time** - Formatted timestamp
2. **Student Name** - From metadata
3. **Email** - From metadata
4. **Subject** - From metadata
5. **Topics** - From metadata
6. **Questions Answered** - Count of Q&A pairs
7. **Score (out of 100)** - Percentage score
8. **Overall Feedback** - Evaluation feedback
9. **Transcript** - Full conversation transcript
10. **Recording** - Recording URL
11. **Evaluation (JSON)** - Complete evaluation JSON

### File System
- **Location:** `evaluations/evaluation-{callId}-{timestamp}.json`
- **Content:** Complete evaluation JSON with:
  - Marks for each question
  - Feedback for each question
  - Strengths and weaknesses
  - Overall feedback
  - Total marks and percentage

## Verification

### Check for Duplicates
- Look for log message: `[Sheets] ⚠️ Call ID {callId} already exists in sheet. Skipping duplicate save.`
- Each call ID should only appear once in the sheet

### Check Evaluation Generation
- Look for log: `[Viva Complete] ✓ Evaluation complete: X/Y (Z%)`
- Check evaluation validation logs for details

### Check File Saving
- Look for log: `[Viva Complete] ✓ Saved evaluation JSON to: evaluations/evaluation-...`
- Check `evaluations/` folder for JSON files

## Testing

1. **Test Deduplication:**
   - Make a viva call
   - Check logs for "duplicate save prevented" message
   - Verify only one row appears in Google Sheets

2. **Test Evaluation:**
   - Check logs for evaluation generation
   - Verify evaluation JSON in Google Sheets column K
   - Check `evaluations/` folder for JSON file

3. **Test Results Display:**
   - Open Google Sheets
   - Verify Score column shows percentage
   - Verify Overall Feedback column has content
   - Verify Evaluation (JSON) column has JSON data

## Next Steps

If issues persist:
1. Check server logs for evaluation generation messages
2. Verify `ANTHROPIC_API_KEY` is set (for AI evaluation)
3. Check that transcript is being parsed correctly
4. Verify Google Sheets permissions
5. Check `evaluations/` folder for saved JSON files
