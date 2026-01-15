/**
 * Test script to verify results, transcript, and JSON are saved to Google Sheets
 */

const http = require('http');

const testData = {
  email: "test@example.com",
  name: "Test Student",
  subject: "Data Structures",
  topics: "Arrays, Linked Lists, Trees",
  transcript: `AI: Welcome to your viva examination. Let's begin with the first question.

Student: Hello, I'm ready.

AI: What is a data structure? Can you explain the concept?

Student: A data structure is a way of organizing and storing data in a computer so that it can be accessed and modified efficiently. It provides a means to manage large amounts of data effectively.

AI: Good. Can you explain the difference between an array and a linked list?

Student: An array is a collection of elements stored in contiguous memory locations. It allows random access to elements using indices. A linked list is a collection of nodes where each node contains data and a reference to the next node. Linked lists allow dynamic memory allocation but require sequential access.

AI: Excellent. What are the time complexities for searching in an array versus a linked list?

Student: For an array, searching takes O(n) time in the worst case if we need to check each element. For a linked list, searching also takes O(n) time because we need to traverse from the head to find the element. However, arrays allow binary search if sorted, which is O(log n).

AI: Very good. That concludes our examination. Thank you for your time.`
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

console.log('🧪 Testing Google Sheets Save Functionality');
console.log('='.repeat(60));
console.log('Test Data:');
console.log(`  Student: ${testData.name} (${testData.email})`);
console.log(`  Subject: ${testData.subject}`);
console.log(`  Topics: ${testData.topics}`);
console.log(`  Transcript Length: ${testData.transcript.length} characters`);
console.log('='.repeat(60));
console.log('');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      console.log(`📥 Response Status: ${res.statusCode} ${res.statusMessage}`);
      console.log('');
      console.log('✅ Test Results:');
      console.log(`   Success: ${response.success}`);
      console.log(`   Sheets Saved: ${response.sheetsSaved}`);
      console.log(`   Call ID: ${response.callId}`);
      console.log('');
      console.log('📊 Evaluation Results:');
      console.log(`   Questions Evaluated: ${response.evaluation?.questionsCount || 0}`);
      console.log(`   Total Marks: ${response.evaluation?.totalMarks || 0}`);
      console.log(`   Max Marks: ${response.evaluation?.maxTotalMarks || 0}`);
      console.log(`   Percentage: ${response.evaluation?.percentage || 0}%`);
      console.log('');
      
      if (response.sheetsSaved) {
        console.log('✅ SUCCESS: Results saved to Google Sheets!');
        console.log('');
        console.log('📋 What was saved:');
        console.log('   ✓ Student information (name, email, subject, topics)');
        console.log('   ✓ Transcript (full conversation)');
        console.log('   ✓ Evaluation results (marks, percentage, feedback)');
        console.log('   ✓ Evaluation JSON (complete evaluation data)');
        console.log('');
        console.log('💡 Next Steps:');
        console.log('   1. Open your Google Sheet (from GOOGLE_SHEET_ID)');
        console.log('   2. Go to the "Viva Results" tab');
        console.log('   3. Check the latest row for:');
        console.log('      - Student: Test Student');
        console.log('      - Email: test@example.com');
        console.log('      - Subject: Data Structures');
        console.log('      - Score: Should show percentage');
        console.log('      - Overall Feedback: Should have feedback text');
        console.log('      - Transcript: Should have full conversation');
        console.log('      - Evaluation (JSON): Should have complete JSON');
        console.log('   4. Check evaluations/ folder for JSON file');
      } else {
        console.log('❌ ERROR: Results were NOT saved to Google Sheets');
        console.log('   Check server logs for error details');
      }
      
      console.log('');
      console.log('='.repeat(60));
    } catch (error) {
      console.error('❌ Error parsing response:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error sending request:', error.message);
  console.log('');
  console.log('💡 Make sure your server is running:');
  console.log('   npm run dev');
});

req.write(postData);
req.end();
