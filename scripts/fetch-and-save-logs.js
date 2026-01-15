/**
 * Script to fetch actual call logs from VAPI and save to LAST_EVALUATION_LOGS.md
 * 
 * Usage:
 *   node scripts/fetch-and-save-logs.js
 *   node scripts/fetch-and-save-logs.js --callId call_abc123
 *   node scripts/fetch-and-save-logs.js --limit 1 --status ended
 */

// Load .env.local manually if dotenv is not available
function loadEnvFile(filePath) {
  try {
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.join(__dirname, '..', filePath);
    
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            // Remove quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            process.env[key] = value;
          }
        }
      }
      return true;
    }
    return false;
  } catch (e) {
    return false;
  }
}

// Try to load dotenv if available, otherwise load .env files manually
try {
  require('dotenv').config({ path: '.env.local' });
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, load manually
  loadEnvFile('.env.local');
  loadEnvFile('.env');
}
const fs = require('fs');
const path = require('path');

const VAPI_API_BASE = "https://api.vapi.ai";

async function fetchVapiCall(callId) {
  const privateKey = process.env.VAPI_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("VAPI_PRIVATE_KEY is not set in environment variables");
  }

  const response = await fetch(`${VAPI_API_BASE}/call/${callId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${privateKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch call: ${response.status} ${errorText}`);
  }

  return await response.json();
}

async function fetchVapiCalls(params) {
  const privateKey = process.env.VAPI_PRIVATE_KEY;

  if (!privateKey) {
    console.error("\n❌ VAPI_PRIVATE_KEY is not set!");
    console.error("\nPlease set it in one of these ways:");
    console.error("1. Create a .env.local file with: VAPI_PRIVATE_KEY=your_key_here");
    console.error("2. Set it as environment variable: export VAPI_PRIVATE_KEY=your_key_here");
    console.error("3. Pass it directly: VAPI_PRIVATE_KEY=your_key_here node scripts/fetch-and-save-logs.js");
    throw new Error("VAPI_PRIVATE_KEY is not set in environment variables");
  }

  const { limit = 1, status = "ended", assistantId } = params;

  const queryParams = new URLSearchParams();
  if (limit) queryParams.append("limit", limit.toString());
  if (status) queryParams.append("status", status);
  if (assistantId) queryParams.append("assistantId", assistantId);

  const url = `${VAPI_API_BASE}/call${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${privateKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch calls: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : data.calls || data.data || [];
}

function formatLogsForMarkdown(call) {
  const timestamp = call.endedAt || call.startedAt || new Date().toISOString();
  const callId = call.id;
  const status = call.status;
  
  // Extract transcript
  const transcript = call.transcript || call.artifact?.transcript || "";
  const messages = call.artifact?.messages || call.messages || [];
  
  // Extract metadata
  const metadata = call.metadata || {};
  const studentEmail = metadata.studentEmail || "unknown@example.com";
  const studentName = metadata.studentName || "Unknown";
  const subject = metadata.subject || "Unknown Subject";
  const topics = metadata.topics || "";
  
  // Build transcript from messages if available
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

  return `# Last Received Evaluation Complete Logs

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
  hasTranscript: ${!!(transcript || messages.length > 0)},
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
Recording URL: ${call.recordingUrl || call.artifact?.recordingUrl || "N/A"}
\`\`\`

### 8. Messages (if available)
\`\`\`
${messages.length > 0 ? messages.map((msg, idx) => {
  const role = msg.role === "assistant" || msg.role === "bot" ? "AI" : "Student";
  const content = msg.content || msg.message || msg.text || "";
  return `${idx + 1}. [${role}]: ${content}`;
}).join("\\n") : "No messages available"}
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
- **Messages Count:** ${messages.length}
- **Has Recording:** ${!!(call.recordingUrl || call.artifact?.recordingUrl)}

---

## Raw Call Data (JSON)

\`\`\`json
${JSON.stringify(call, null, 2)}
\`\`\`

---

**Note:** This log was retrieved from VAPI API at ${new Date().toISOString()}
`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    limit: 1,
    status: "ended",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--callId' && args[i + 1]) {
      params.callId = args[++i];
    } else if (arg === '--limit' && args[i + 1]) {
      params.limit = parseInt(args[++i], 10);
    } else if (arg === '--status' && args[i + 1]) {
      params.status = args[++i];
    } else if (arg === '--assistantId' && args[i + 1]) {
      params.assistantId = args[++i];
    }
  }

  return params;
}

async function main() {
  try {
    const params = parseArgs();
    
    console.log('🔍 Fetching VAPI call logs...');
    console.log('Parameters:', params);
    console.log('');

    let calls;
    if (params.callId) {
      console.log(`Fetching specific call: ${params.callId}`);
      const call = await fetchVapiCall(params.callId);
      calls = [call];
    } else {
      console.log(`Fetching latest ${params.limit} call(s) with status: ${params.status}`);
      calls = await fetchVapiCalls(params);
    }

    if (calls.length === 0) {
      console.log('⚠️  No calls found');
      return;
    }

    console.log(`✅ Retrieved ${calls.length} call(s)\n`);

    // Use the most recent call
    const call = calls[0];
    console.log(`Using call: ${call.id} (${call.status})`);

    // Format logs
    const markdown = formatLogsForMarkdown(call);

    // Save to file
    const outputPath = path.join(__dirname, '..', 'LAST_EVALUATION_LOGS.md');
    fs.writeFileSync(outputPath, markdown);
    console.log(`\n💾 Saved logs to: ${outputPath}`);

    // Also save raw JSON
    const jsonPath = path.join(__dirname, '..', `vapi-call-${call.id}-${Date.now()}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(call, null, 2));
    console.log(`💾 Saved raw call data to: ${jsonPath}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchVapiCall, fetchVapiCalls, formatLogsForMarkdown };
