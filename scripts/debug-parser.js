/**
 * Debug script to test the transcript parser directly
 */

const fs = require('fs');
const path = require('path');

// Read the call data
const callData = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'last-call-data.json'), 'utf8'));

// Build transcript from messages (same as process-last-call.js)
const messages = callData.messages || [];
const messageLines = messages
  .filter(msg => {
    const role = msg.role || "";
    const content = msg.content || msg.message || msg.text || "";
    return role !== "system" && content.trim().length > 0;
  })
  .map(msg => {
    const role = msg.role || "";
    const content = msg.content || msg.message || msg.text || "";
    
    let roleLabel = "Student";
    if (role === "bot" || role === "assistant" || role === "ai") {
      roleLabel = "AI";
    } else if (role === "user" || role === "student" || role === "candidate") {
      roleLabel = "Student";
    }
    
    const cleanedContent = (content || "").trim();
    if (cleanedContent.length === 0) return null;
    
    return `${roleLabel}: ${cleanedContent}`;
  })
  .filter(line => line !== null);

const transcript = messageLines.join("\n");

console.log("=".repeat(80));
console.log("TESTING TRANSCRIPT PARSER");
console.log("=".repeat(80));
console.log("\nTranscript:");
console.log(transcript);
console.log("\n" + "=".repeat(80));
console.log("Line by line analysis:");
console.log("=".repeat(80));

const lines = transcript.split("\n").filter(line => line.trim().length > 0);
lines.forEach((line, idx) => {
  const trimmed = line.trim();
  const aiMatch = trimmed.match(/^(?:AI|bot|assistant|examiner|teacher):\s*(.+)/i);
  const studentMatch = trimmed.match(/^(?:Student|user|candidate|you):\s*(.+)/i);
  
  console.log(`\nLine ${idx + 1}:`);
  console.log(`  Content: ${trimmed.substring(0, 100)}${trimmed.length > 100 ? '...' : ''}`);
  console.log(`  AI Match: ${aiMatch ? 'YES' : 'NO'}`);
  console.log(`  Student Match: ${studentMatch ? 'YES' : 'NO'}`);
  
  if (aiMatch) {
    const aiMessage = aiMatch[1];
    // Check for question patterns
    const hasQuestionMark = aiMessage.includes("?");
    const hasQuestionWords = /\b(what|how|why|when|where|which|who|whom|whose|can you|could you|would you|will you|do you|does|did|are|is|was|were|explain|describe|define|tell me|give me|list|name|provide|elaborate|discuss|compare|contrast|imagine)\b/i.test(aiMessage);
    console.log(`  Has '?': ${hasQuestionMark}`);
    console.log(`  Has question words: ${hasQuestionWords}`);
    console.log(`  Message: ${aiMessage.substring(0, 150)}${aiMessage.length > 150 ? '...' : ''}`);
  }
  
  if (studentMatch) {
    const studentMessage = studentMatch[1];
    console.log(`  Student message length: ${studentMessage.length}`);
    console.log(`  Message: ${studentMessage.substring(0, 150)}${studentMessage.length > 150 ? '...' : ''}`);
  }
});

console.log("\n" + "=".repeat(80));
console.log("Now testing with actual parser via API...");
console.log("=".repeat(80));

// Test via API
const http = require('http');
const postData = JSON.stringify({
  transcript: transcript,
  name: "Aditya",
  email: "test@example.com",
  subject: "Introduction to Stock Market",
  topics: "Technical Analysis",
});

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
      console.log("\nAPI Response:");
      console.log(JSON.stringify(response, null, 2));
    } catch (error) {
      console.error("Error parsing response:", error);
      console.log("Raw response:", data.substring(0, 1000));
    }
  });
});

req.on('error', (error) => {
  console.error("Request error:", error);
});

req.write(postData);
req.end();
