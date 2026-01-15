/**
 * Test the transcript parser with the actual call data
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
console.log("TRANSCRIPT:");
console.log("=".repeat(80));
console.log(transcript);
console.log("=".repeat(80));
console.log(`\nTotal lines: ${transcript.split("\n").length}`);
console.log(`Has AI: ${/^AI:/m.test(transcript)}`);
console.log(`Has Student: ${/^Student:/m.test(transcript)}`);

// Now test the parser by calling the API endpoint
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

console.log("\n" + "=".repeat(80));
console.log("SENDING TO TEST ENDPOINT...");
console.log("=".repeat(80));

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log("\nRESPONSE:");
      console.log(JSON.stringify(response, null, 2));
      
      if (response.evaluation) {
        console.log(`\nQuestions Evaluated: ${response.evaluation.questionsCount || 0}`);
        console.log(`Total Marks: ${response.evaluation.totalMarks || 0}`);
        console.log(`Max Marks: ${response.evaluation.maxTotalMarks || 0}`);
        console.log(`Percentage: ${response.evaluation.percentage || 0}%`);
      }
    } catch (error) {
      console.error("Error parsing response:", error);
      console.log("Raw response:", data);
    }
  });
});

req.on('error', (error) => {
  console.error("Error:", error);
});

req.write(postData);
req.end();
