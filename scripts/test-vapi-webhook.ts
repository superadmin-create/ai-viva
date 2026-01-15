/**
 * Test script to simulate VAPI webhook calls and verify results are saved to Google Sheets
 * 
 * Usage:
 *   npx tsx scripts/test-vapi-webhook.ts
 * 
 * Or with custom data:
 *   npx tsx scripts/test-vapi-webhook.ts --email test@example.com --name "Test Student"
 */

import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });
config({ path: ".env" });

interface TestOptions {
  email?: string;
  name?: string;
  subject?: string;
  topics?: string;
  webhookUrl?: string;
}

async function testVapiWebhook(options: TestOptions = {}) {
  const {
    email = "test@example.com",
    name = "Test Student",
    subject = "Data Structures",
    topics = "Arrays, Linked Lists, Trees",
    webhookUrl = process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/viva-complete`
      : "http://localhost:3000/api/viva-complete",
  } = options;

  console.log("🧪 Testing VAPI Webhook Endpoint");
  console.log("=" .repeat(50));
  console.log(`Webhook URL: ${webhookUrl}`);
  console.log(`Student Email: ${email}`);
  console.log(`Student Name: ${name}`);
  console.log(`Subject: ${subject}`);
  console.log(`Topics: ${topics}`);
  console.log("=" .repeat(50));

  // Simulate a realistic VAPI webhook payload
  const mockVapiPayload = {
    message: {
      type: "end-of-call-report",
      call: {
        id: `test-call-${Date.now()}`,
        assistantId: "test-assistant-id",
        status: "ended",
        startedAt: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
        endedAt: new Date().toISOString(),
        duration: 600, // 10 minutes in seconds
        transcript: `AI: Welcome to your viva examination. Let's begin with the first question.

Student: Hello, I'm ready.

AI: What is a data structure? Can you explain the concept?

Student: A data structure is a way of organizing and storing data in a computer so that it can be accessed and modified efficiently. It provides a means to manage large amounts of data effectively.

AI: Good. Can you explain the difference between an array and a linked list?

Student: An array is a collection of elements stored in contiguous memory locations. It allows random access to elements using indices. A linked list is a collection of nodes where each node contains data and a reference to the next node. Linked lists allow dynamic memory allocation but require sequential access.

AI: Excellent. What are the time complexities for searching in an array versus a linked list?

Student: For an array, searching takes O(n) time in the worst case if we need to check each element. For a linked list, searching also takes O(n) time because we need to traverse from the head to find the element. However, arrays allow binary search if sorted, which is O(log n).

AI: Very good. That concludes our examination. Thank you for your time.`,
        recordingUrl: "https://example.com/recording/test-call.mp3",
        metadata: {
          studentEmail: email,
          studentName: name,
          subject: subject,
          topics: topics,
        },
      },
      artifact: {
        transcript: `AI: Welcome to your viva examination. Let's begin with the first question.

Student: Hello, I'm ready.

AI: What is a data structure? Can you explain the concept?

Student: A data structure is a way of organizing and storing data in a computer so that it can be accessed and modified efficiently. It provides a means to manage large amounts of data effectively.

AI: Good. Can you explain the difference between an array and a linked list?

Student: An array is a collection of elements stored in contiguous memory locations. It allows random access to elements using indices. A linked list is a collection of nodes where each node contains data and a reference to the next node. Linked lists allow dynamic memory allocation but require sequential access.

AI: Excellent. What are the time complexities for searching in an array versus a linked list?

Student: For an array, searching takes O(n) time in the worst case if we need to check each element. For a linked list, searching also takes O(n) time because we need to traverse from the head to find the element. However, arrays allow binary search if sorted, which is O(log n).

AI: Very good. That concludes our examination. Thank you for your time.`,
        messages: [
          {
            role: "assistant",
            content: "Welcome to your viva examination. Let's begin with the first question.",
          },
          {
            role: "user",
            content: "Hello, I'm ready.",
          },
          {
            role: "assistant",
            content: "What is a data structure? Can you explain the concept?",
          },
          {
            role: "user",
            content: "A data structure is a way of organizing and storing data in a computer so that it can be accessed and modified efficiently. It provides a means to manage large amounts of data effectively.",
          },
          {
            role: "assistant",
            content: "Good. Can you explain the difference between an array and a linked list?",
          },
          {
            role: "user",
            content: "An array is a collection of elements stored in contiguous memory locations. It allows random access to elements using indices. A linked list is a collection of nodes where each node contains data and a reference to the next node. Linked lists allow dynamic memory allocation but require sequential access.",
          },
          {
            role: "assistant",
            content: "Excellent. What are the time complexities for searching in an array versus a linked list?",
          },
          {
            role: "user",
            content: "For an array, searching takes O(n) time in the worst case if we need to check each element. For a linked list, searching also takes O(n) time because we need to traverse from the head to find the element. However, arrays allow binary search if sorted, which is O(log n).",
          },
          {
            role: "assistant",
            content: "Very good. That concludes our examination. Thank you for your time.",
          },
        ],
        recordingUrl: "https://example.com/recording/test-call.mp3",
      },
    },
  };

  try {
    console.log("\n📤 Sending webhook request...");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Note: In a real scenario, VAPI would include x-vapi-signature header
        // For testing, we'll skip signature verification if VAPI_WEBHOOK_SECRET is not set
      },
      body: JSON.stringify(mockVapiPayload),
    });

    const responseText = await response.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log(`\n📥 Response Status: ${response.status} ${response.statusText}`);
    console.log("Response Body:", JSON.stringify(responseData, null, 2));

    if (response.ok) {
      console.log("\n✅ Webhook processed successfully!");
      if (responseData.sheetsSaved) {
        console.log("✅ Results saved to Google Sheets!");
        console.log(`\n📊 Evaluation Summary:`);
        console.log(`   Total Marks: ${responseData.evaluation?.totalMarks || "N/A"}`);
        console.log(`   Max Marks: ${responseData.evaluation?.maxTotalMarks || "N/A"}`);
        console.log(`   Percentage: ${responseData.evaluation?.percentage || "N/A"}%`);
      } else {
        console.warn("⚠️  Webhook processed but results may not have been saved to sheets");
        console.warn("   Check your server logs for details");
      }
    } else {
      console.error("\n❌ Webhook request failed!");
      console.error("   Check the error message above");
    }

    console.log("\n" + "=".repeat(50));
    console.log("💡 Next Steps:");
    console.log("   1. Check your server logs for detailed processing information");
    console.log("   2. Verify the results appear in your Google Sheets 'Viva Results' tab");
    console.log("   3. Check that all environment variables are set correctly:");
    console.log("      - GOOGLE_PRIVATE_KEY");
    console.log("      - GOOGLE_CLIENT_EMAIL");
    console.log("      - GOOGLE_SHEET_ID");
    console.log("   4. Ensure the service account has write access to the sheet");
    console.log("=".repeat(50));

    return response.ok && responseData.sheetsSaved;
  } catch (error) {
    console.error("\n❌ Error sending webhook request:", error);
    if (error instanceof Error) {
      console.error("   Error message:", error.message);
      console.error("   Stack:", error.stack);
    }
    return false;
  }
}

// Parse command line arguments
function parseArgs(): TestOptions {
  const args = process.argv.slice(2);
  const options: TestOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--email" && args[i + 1]) {
      options.email = args[++i];
    } else if (arg === "--name" && args[i + 1]) {
      options.name = args[++i];
    } else if (arg === "--subject" && args[i + 1]) {
      options.subject = args[++i];
    } else if (arg === "--topics" && args[i + 1]) {
      options.topics = args[++i];
    } else if (arg === "--url" && args[i + 1]) {
      options.webhookUrl = args[++i];
    }
  }

  return options;
}

// Run the test
if (require.main === module) {
  const options = parseArgs();
  testVapiWebhook(options)
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error("Fatal error:", error);
      process.exit(1);
    });
}

export { testVapiWebhook };
