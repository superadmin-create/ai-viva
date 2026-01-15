/**
 * Script to retrieve the last VAPI call, generate evaluation, and save to Google Sheets
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// Step 1: Fetch the latest call from VAPI
function fetchLatestCall() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/fetch-vapi-calls?limit=1',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.success && response.calls && response.calls.length > 0) {
            resolve(response.calls[0]);
          } else {
            reject(new Error('No calls found or error: ' + (response.error || 'Unknown')));
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Step 2: Extract metadata from system message
function extractMetadataFromSystemMessage(messages) {
  const systemMessage = messages.find(msg => msg.role === "system");
  if (!systemMessage) return {};

  const messageText = systemMessage.message || systemMessage.content || "";
  
  // Extract student info from system message
  const nameMatch = messageText.match(/Name:\s*([^\n-]+)/i);
  const subjectMatch = messageText.match(/Subject:\s*([^\n-]+)/i);
  const topicsMatch = messageText.match(/Topics:\s*([^\n]+)/i);
  
  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    subject: subjectMatch ? subjectMatch[1].trim() : null,
    topics: topicsMatch ? topicsMatch[1].trim() : null,
  };
}

// Step 3: Process the call and save to sheets using the test endpoint
function processAndSaveCall(call) {
  return new Promise((resolve, reject) => {
    // Extract data from the call
    const metadata = call.metadata || {};
    const transcript = call.transcript || '';
    const messages = call.messages || [];

    // Extract metadata from system message
    const systemMetadata = extractMetadataFromSystemMessage(messages);

    // Build transcript from messages (like viva-complete endpoint does)
    // This ensures proper formatting and role normalization
    let formattedTranscript = transcript;
    if (messages && messages.length > 0) {
      const messageLines = messages
        .filter(msg => {
          // Exclude system messages and empty messages
          const role = msg.role || "";
          const content = msg.content || msg.message || msg.text || "";
          return role !== "system" && content.trim().length > 0;
        })
        .map(msg => {
          const role = msg.role || "";
          const content = msg.content || msg.message || msg.text || "";
          
          // Normalize role names (same as viva-complete endpoint)
          let roleLabel = "Student";
          if (role === "bot" || role === "assistant" || role === "ai") {
            roleLabel = "AI";
          } else if (role === "user" || role === "student" || role === "candidate") {
            roleLabel = "Student";
          }
          
          // Clean content and ensure it's not empty
          const cleanedContent = (content || "").trim();
          if (cleanedContent.length === 0) return null;
          
          return `${roleLabel}: ${cleanedContent}`;
        })
        .filter(line => line !== null);
      
      if (messageLines.length > 0) {
        formattedTranscript = messageLines.join("\n");
        console.log(`[Process] Built transcript from ${messages.length} messages into ${messageLines.length} transcript lines`);
      }
    }
    
    // If we still don't have a transcript, normalize the existing one
    if (formattedTranscript && formattedTranscript.includes("User:")) {
      // Normalize "User:" to "Student:" for parser compatibility
      formattedTranscript = formattedTranscript.replace(/^User:/gm, "Student:");
    }

    // Use actual call ID instead of generating a test one
    const callId = call.id || `call-${Date.now()}`;

    const testData = {
      callId: callId, // Pass the actual call ID
      email: metadata.studentEmail || call.studentEmail || "unknown@example.com",
      name: systemMetadata.name || metadata.studentName || call.studentName || "Unknown Student",
      subject: systemMetadata.subject || metadata.subject || call.subject || "Unknown Subject",
      topics: systemMetadata.topics || metadata.topics || call.topics || "",
      transcript: formattedTranscript,
    };

    const postData = JSON.stringify(testData);

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/test-vapi-webhook',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    // Try to load from saved file first, otherwise fetch
    const callDataFile = path.join(__dirname, '..', 'last-call-data.json');
    let call;
    
    if (fs.existsSync(callDataFile)) {
      console.log('📂 Loading call data from saved file...');
      const fileContent = fs.readFileSync(callDataFile, 'utf8');
      call = JSON.parse(fileContent);
      console.log('✅ Loaded call data from file');
    } else {
      console.log('🔍 Step 1: Fetching latest VAPI call...');
      call = await fetchLatestCall();
      
      // Save call data for reference
      fs.writeFileSync(callDataFile, JSON.stringify(call, null, 2));
      console.log(`💾 Saved call data to: ${callDataFile}`);
    }
    
    console.log('');
    console.log('✅ Retrieved latest call:');
    console.log(`   Call ID: ${call.id}`);
    console.log(`   Status: ${call.status}`);
    console.log(`   Started: ${call.startedAt || 'N/A'}`);
    console.log(`   Ended: ${call.endedAt || 'N/A'}`);
    console.log(`   Has Transcript: ${call.hasTranscript}`);
    console.log(`   Transcript Length: ${call.transcriptLength}`);
    console.log(`   Message Count: ${call.messageCount || 0}`);
    console.log('');

    if (!call.hasTranscript && (!call.messages || call.messages.length === 0)) {
      console.error('❌ Error: Call has no transcript or messages to evaluate');
      process.exit(1);
    }

    console.log('🔄 Step 2: Processing call and generating evaluation...');
    console.log(`[Process] Transcript preview: ${call.transcript ? call.transcript.substring(0, 200) : 'No transcript'}`);
    console.log(`[Process] Messages count: ${call.messages ? call.messages.length : 0}`);
    const result = await processAndSaveCall(call);

    console.log('');
    console.log('✅ Step 3: Evaluation saved!');
    console.log('');
    console.log('📊 Results:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Sheets Saved: ${result.sheetsSaved}`);
    console.log(`   Call ID: ${result.callId}`);
    console.log(`   Questions Evaluated: ${result.evaluation?.questionsCount || 0}`);
    console.log(`   Total Marks: ${result.evaluation?.totalMarks || 0}`);
    console.log(`   Max Marks: ${result.evaluation?.maxTotalMarks || 0}`);
    console.log(`   Percentage: ${result.evaluation?.percentage || 0}%`);
    console.log('');

    if (result.sheetsSaved) {
      console.log('✅ SUCCESS: Evaluation saved to Google Sheets!');
      console.log('');
      console.log('💡 Next Steps:');
      console.log('   1. Open your Google Sheet (from GOOGLE_SHEET_ID)');
      console.log('   2. Go to the "Viva Results" tab');
      console.log('   3. Find the row with Call ID:', result.callId);
      console.log('   4. Verify all columns are populated:');
      console.log('      - Student information');
      console.log('      - Transcript');
      console.log('      - Score and percentage');
      console.log('      - Overall feedback');
      console.log('      - Evaluation JSON');
      console.log('   5. Check evaluations/ folder for JSON file');
    } else {
      console.error('❌ ERROR: Evaluation was NOT saved to Google Sheets');
      console.error('   Check server logs for error details');
    }

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

module.exports = { fetchLatestCall, processAndSaveCall };
