# Logging Points for Completed Viva Sessions

All logs are written to the **server console** (stdout/stderr) using `console.log()`, `console.warn()`, and `console.error()`.

## Log Location
**File:** `app/api/viva-complete/route.ts`  
**Endpoint:** `/api/viva-complete` (POST)

## Complete Logging Flow

### 1. Webhook Reception (Lines 36-57)
```typescript
console.log("[Viva Complete] ===== WEBHOOK RECEIVED =====");
console.log("[Viva Complete] Timestamp:", new Date().toISOString());
console.log("[Viva Complete] Raw payload length:", rawBody.length);
console.log("[Viva Complete] Raw payload (first 2000 chars):", ...);
console.log("[Viva Complete] Payload keys:", Object.keys(body));
console.log("[Viva Complete] Message type:", body.message?.type);
console.log("[Viva Complete] Has message object:", !!body.message);
console.log("[Viva Complete] Has call at root:", !!body.call);
console.log("[Viva Complete] Message keys:", ...);
console.log("[Viva Complete] Full payload structure:", ...);
```
**Purpose:** Logs when webhook is received and initial payload structure

---

### 2. Webhook Signature Verification (Lines 71, 77)
```typescript
console.error("[Viva Complete] Invalid webhook signature");
// OR
console.log("[Viva Complete] Webhook signature verified");
```
**Purpose:** Security verification logs

---

### 3. Call Data Extraction (Lines 99, 115-122)
```typescript
console.log("[Viva Complete] Found call data at:", callSource);
console.log("[Viva Complete] Webhook analysis:", {
  messageType, callStatus, hasCall, hasTranscript, isEndOfCall, callId
});
```
**Purpose:** Logs where call data was found and webhook analysis

---

### 4. Processing Start (Lines 154-160)
```typescript
console.log("[Viva Complete] Processing call completion");
console.log("[Viva Complete] Message type:", messageType || "none");
console.log("[Viva Complete] Call status:", callStatus || "unknown");
console.log("[Viva Complete] Is end of call:", isEndOfCall);
console.log(`[Viva Complete] Processing call ${callId}`);
```
**Purpose:** Logs that processing has started

---

### 5. Metadata Extraction (Lines 163-188)
```typescript
console.log("[Viva Complete] Full call object keys:", Object.keys(call));
console.log("[Viva Complete] call.metadata:", JSON.stringify(call.metadata, null, 2));
console.log("[Viva Complete] call.assistantOverrides:", JSON.stringify(call.assistantOverrides, null, 2));
console.log("[Viva Complete] Extracted metadata:", JSON.stringify(metadata, null, 2));
console.log("[Viva Complete] Variable values:", JSON.stringify(variableValues, null, 2));
console.log("[Viva Complete] Final student data:", { studentEmail, studentName, subject, topics });
console.warn("[Viva Complete] No student email in metadata");
```
**Purpose:** Logs student information extraction

---

### 6. Transcript Processing (Lines 233-266)
```typescript
console.log("[Viva Complete] Built transcript from messages array (excluding system messages)");
console.log(`[Viva Complete] Processed ${artifact.messages.length} messages into ${messageLines.length} transcript lines`);
console.log("[Viva Complete] Transcript length:", transcript.length);
console.log("[Viva Complete] Transcript preview:", transcript.substring(0, 500));
console.log("[Viva Complete] Transcript line count:", transcript.split("\n").length);
console.warn("[Viva Complete] No transcript found in call data");
console.log(`[Viva Complete] Transcript validation: Has AI messages: ${hasAI}, Has Student messages: ${hasStudent}`);
console.warn("[Viva Complete] Transcript may be incomplete - missing AI or Student messages");
```
**Purpose:** Logs transcript extraction and validation

---

### 7. Q&A Parsing (Lines 269-284)
```typescript
console.log("[Viva Complete] Parsing transcript into Q&A pairs...");
console.log(`[Viva Complete] Found ${parsedTranscript.questions.length} Q&A pairs from transcript`);
console.log(`[Viva Complete] Q${idx + 1}: "${qa.question.substring(0, 100)}..."`);
console.log(`[Viva Complete] A${idx + 1}: "${qa.answer.substring(0, 100)}..."`);
console.warn("[Viva Complete] WARNING: No Q&A pairs extracted from transcript!");
console.warn("[Viva Complete] This means evaluation cannot proceed accurately.");
console.warn("[Viva Complete] Transcript content:", transcript.substring(0, 1000));
```
**Purpose:** Logs Q&A pair extraction from transcript

---

### 8. Evaluation (Lines 289-316)
```typescript
console.log("[Viva Complete] Evaluating viva based on transcript Q&A pairs...");
console.warn("[Viva Complete] WARNING: No Q&A pairs found in transcript - creating empty evaluation");
console.warn("[Viva Complete] Will still save transcript to sheets for review");
console.log(`[Viva Complete] Evaluation complete: ${evaluation.totalMarks}/${evaluation.maxTotalMarks} (${evaluation.percentage}%)`);
console.error("[Viva Complete] ERROR: Evaluation failed:", evalError);
console.error("[Viva Complete] Will still save transcript to sheets with error evaluation");
```
**Purpose:** Logs evaluation process and results

---

### 9. Data Preparation (Lines 352-384)
```typescript
console.log("[Viva Complete] Evaluation JSON formatted successfully, length:", evaluationJson.length);
console.error("[Viva Complete] ERROR: Failed to format evaluation as JSON:", jsonError);
console.log("[Viva Complete] Using fallback JSON stringification");
console.log("[Viva Complete] Validating sheet row data...");
console.warn("[Viva Complete] WARNING: Student email is missing or default");
console.error("[Viva Complete] ERROR: Evaluation JSON is empty!");
console.log("[Viva Complete] ✓ Sheet row data validated");
```
**Purpose:** Logs data preparation and validation

---

### 10. Google Sheets Saving (Lines 388-453)
```typescript
console.log("[Viva Complete] ===== SAVING TO GOOGLE SHEETS =====");
console.log("[Viva Complete] Call ID:", callId);
console.log("[Viva Complete] Timestamp:", timestamp);
console.log("[Viva Complete] Sheet row data:", { ... });
console.log(`[Viva Complete] Attempt ${attempt}/${maxRetries} to save to sheets...`);
console.log(`[Viva Complete] ✓ Successfully saved to Google Sheets on attempt ${attempt}`);
console.log("[Viva Complete] Results should now be visible in the 'Viva Results' sheet");
console.warn(`[Viva Complete] Attempt ${attempt} failed:`, sheetsResult.error);
console.log(`[Viva Complete] Retrying in 1 second...`);
console.error(`[Viva Complete] Exception during save attempt ${attempt}:`, saveError);
console.error("[Viva Complete] ===== CRITICAL ERROR: FAILED TO SAVE TO SHEETS =====");
console.error("[Viva Complete] Error after all retries:", sheetsResult.error);
console.error("[Viva Complete] This means the results will NOT appear in Google Sheets!");
// ... detailed error messages
```
**Purpose:** Logs the entire Google Sheets saving process with retry logic

---

### 11. Completion (Lines 457-459)
```typescript
console.log(`[Viva Complete] Successfully processed call ${callId} in ${processingTime}ms`);
```
**Purpose:** Logs successful completion with processing time

---

### 12. Error Handling (Lines 474-492)
```typescript
console.error("[Viva Complete] ===== CRITICAL ERROR IN WEBHOOK PROCESSING =====");
console.error("[Viva Complete] Error processing webhook:", error);
console.error("[Viva Complete] Error details:", { message, stack, name, processingTime });
console.error("[Viva Complete] Error (non-Error object):", JSON.stringify(error, null, 2));
console.error("[Viva Complete] ===== END CRITICAL ERROR =====");
```
**Purpose:** Logs any critical errors during processing

---

## Additional Logs from Sheets Module

The `saveToSheets()` function in `lib/utils/sheets.ts` also logs extensively:

- `[Sheets] ===== Starting save to Google Sheets =====`
- `[Sheets] Sheet ID: ...`
- `[Sheets] Service Account: ...`
- `[Sheets] ✓ Authentication successful`
- `[Sheets] ✓ Spreadsheet found: ...`
- `[Sheets] ✓ Headers verified/created`
- `[Sheets] Preparing to append row: ...`
- `[Sheets] ✓ Successfully saved to Google Sheets!`
- `[Sheets] Updated range: ...`
- `[Sheets] Updated rows: ...`
- `[Sheets] Updated cells: ...`
- `[Sheets] ===== ERROR SAVING TO GOOGLE SHEETS =====` (on errors)

---

## How to View Logs

### Development (Local)
```bash
npm run dev
# Logs appear in the terminal/console where you ran the command
```

### Production
- **Vercel:** Check Vercel Dashboard > Your Project > Logs
- **Other platforms:** Check your hosting platform's log viewer
- **Docker:** `docker logs <container-name>`
- **PM2:** `pm2 logs`

---

## Log Format

All logs are prefixed with `[Viva Complete]` or `[Sheets]` for easy filtering:

```bash
# Filter logs in terminal
npm run dev | grep "\[Viva Complete\]"

# Or in production logs
grep "\[Viva Complete\]" /var/log/app.log
```

---

## Key Log Messages to Monitor

### Success Indicators:
- ✅ `[Viva Complete] ===== WEBHOOK RECEIVED =====`
- ✅ `[Viva Complete] Processing call completion`
- ✅ `[Viva Complete] Evaluation complete: X/Y (Z%)`
- ✅ `[Viva Complete] ✓ Successfully saved to Google Sheets`
- ✅ `[Viva Complete] Successfully processed call ... in ...ms`

### Warning Indicators:
- ⚠️ `[Viva Complete] WARNING: No Q&A pairs found`
- ⚠️ `[Viva Complete] WARNING: Call ended but no transcript found`
- ⚠️ `[Viva Complete] WARNING: Student email is missing or default`

### Error Indicators:
- ❌ `[Viva Complete] ERROR: Evaluation failed`
- ❌ `[Viva Complete] ===== CRITICAL ERROR: FAILED TO SAVE TO SHEETS =====`
- ❌ `[Viva Complete] ===== CRITICAL ERROR IN WEBHOOK PROCESSING =====`

---

## Summary

**All logs are written to:**
- Server console (stdout/stderr)
- Prefixed with `[Viva Complete]` or `[Sheets]`
- Include timestamps, call IDs, and detailed information
- Cover the entire flow from webhook receipt to Google Sheets saving

**To view logs:**
- Check your server console/terminal
- Check your hosting platform's log viewer
- Use grep/filter to find specific log entries
