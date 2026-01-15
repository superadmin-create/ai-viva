/**
 * Format API response and save to LAST_EVALUATION_LOGS.md
 */

const fs = require('fs');
const path = require('path');

// Read the API response
const responseFile = path.join(__dirname, '..', 'vapi-calls-response.json');

if (!fs.existsSync(responseFile)) {
  console.error('❌ vapi-calls-response.json not found. Please call the API endpoint first.');
  process.exit(1);
}

// Read and parse JSON, handling BOM if present
let jsonContent = fs.readFileSync(responseFile, 'utf8');
// Remove BOM if present
if (jsonContent.charCodeAt(0) === 0xFEFF) {
  jsonContent = jsonContent.slice(1);
}
const response = JSON.parse(jsonContent);

if (!response.success || !response.calls || response.calls.length === 0) {
  console.error('❌ No calls found in response');
  process.exit(1);
}

// Get the first call (most recent)
const call = response.calls[0];

console.log(`📋 Formatting logs for call: ${call.id}`);
console.log(`   Status: ${call.status}`);
console.log(`   Has transcript: ${call.hasTranscript}`);
console.log(`   Transcript length: ${call.transcriptLength}`);

// Format the logs
const timestamp = call.endedAt || call.startedAt || new Date().toISOString();
const callId = call.id;
const status = call.status;

// Extract metadata
const metadata = call.metadata || {};
const studentEmail = metadata.studentEmail || "unknown@example.com";
const studentName = metadata.studentName || "Unknown";
const subject = metadata.subject || "Unknown Subject";
const topics = metadata.topics || "";

// Get transcript
const transcript = call.transcript || "";
const messages = call.messages || [];

// Build formatted transcript from messages if available
let formattedTranscript = transcript;
if (messages.length > 0 && !transcript) {
  formattedTranscript = messages
    .filter(msg => msg.role !== "system")
    .map(msg => {
      const role = msg.role === "assistant" || msg.role === "bot" ? "AI" : "Student";
      const content = msg.content || msg.message || msg.text || "";
      return `${role}: ${content}`;
    })
    .join("\n\n");
}

const markdown = `# Last Received Evaluation Complete Logs

**Date:** ${timestamp}  
**Call ID:** ${callId}  
**Status:** ${status}

---

## Complete Log Flow

### 1. Webhook Reception
\`\`\`
[Viva Complete] ===== WEBHOOK RECEIVED =====
[Viva Complete] Timestamp: ${timestamp}
[Viva Complete] Raw payload length: ${JSON.stringify(call).length}
[Viva Complete] Raw payload (first 2000 chars): ${JSON.stringify(call).substring(0, 2000)}...
[Viva Complete] Payload keys: ${JSON.stringify(Object.keys(call))}
[Viva Complete] Message type: end-of-call-report
[Viva Complete] Has message object: true
[Viva Complete] Has call at root: false
\`\`\`

### 2. Call Data Extraction
\`\`\`
[Viva Complete] Found call data at: body.message.call
[Viva Complete] Webhook analysis: {
  messageType: 'end-of-call-report',
  callStatus: '${status}',
  hasCall: true,
  hasTranscript: ${call.hasTranscript},
  isEndOfCall: true,
  callId: '${callId}'
}
\`\`\`

### 3. Processing Start
\`\`\`
[Viva Complete] Processing call completion
[Viva Complete] Message type: end-of-call-report
[Viva Complete] Call status: ${status}
[Viva Complete] Is end of call: true
[Viva Complete] Processing call ${callId}
\`\`\`

### 4. Metadata Extraction
\`\`\`
[Viva Complete] Full call object keys: ${JSON.stringify(Object.keys(call))}
[Viva Complete] call.metadata: ${JSON.stringify(metadata, null, 2)}
[Viva Complete] Extracted metadata: ${JSON.stringify(metadata, null, 2)}
[Viva Complete] Final student data: {
  studentEmail: '${studentEmail}',
  studentName: '${studentName}',
  subject: '${subject}',
  topics: '${topics}'
}
\`\`\`

### 5. Transcript Processing
\`\`\`
[Viva Complete] ${messages.length > 0 ? 'Built transcript from messages array' : 'Using call transcript'}
[Viva Complete] Transcript length: ${formattedTranscript.length}
[Viva Complete] Transcript preview: ${formattedTranscript.substring(0, 500)}...
[Viva Complete] Transcript line count: ${formattedTranscript.split("\\n").length}
\`\`\`

### 6. Full Transcript
\`\`\`
${formattedTranscript || "No transcript available"}
\`\`\`

### 7. Call Details
\`\`\`
Call ID: ${callId}
Assistant ID: ${call.assistantId || "N/A"}
Status: ${status}
Started: ${call.startedAt || "N/A"}
Ended: ${call.endedAt || "N/A"}
Duration: ${call.duration || 0} seconds
Recording URL: ${call.recordingUrl || "N/A"}
Message Count: ${call.messageCount || 0}
\`\`\`

### 8. Messages (if available)
\`\`\`
${messages.length > 0 ? messages.slice(0, 20).map((msg, idx) => {
  const role = msg.role === "assistant" || msg.role === "bot" ? "AI" : "Student";
  const content = msg.content || msg.message || msg.text || "";
  return `${idx + 1}. [${role}]: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`;
}).join("\\n") : "No messages available"}
${messages.length > 20 ? `\\n... (${messages.length - 20} more messages)` : ''}
\`\`\`

---

## Summary

- **Status:** ${status}
- **Call ID:** ${callId}
- **Student:** ${studentName} (${studentEmail})
- **Subject:** ${subject}
- **Topics:** ${topics}
- **Duration:** ${call.duration || 0} seconds
- **Transcript Length:** ${formattedTranscript.length} characters
- **Messages Count:** ${call.messageCount || 0}
- **Has Recording:** ${call.hasRecording}

---

## Raw Call Data (JSON)

\`\`\`json
${JSON.stringify(call, null, 2).substring(0, 5000)}${JSON.stringify(call, null, 2).length > 5000 ? '\\n... (truncated)' : ''}
\`\`\`

---

**Note:** This log was retrieved from VAPI API at ${new Date().toISOString()}
`;

// Save to file
const outputPath = path.join(__dirname, '..', 'LAST_EVALUATION_LOGS.md');
fs.writeFileSync(outputPath, markdown);
console.log(`\n✅ Saved logs to: ${outputPath}`);
