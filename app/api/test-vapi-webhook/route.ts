/**
 * Test endpoint to simulate VAPI webhook calls
 * This endpoint allows you to test the webhook handler without needing VAPI
 * 
 * Usage:
 *   POST /api/test-vapi-webhook
 *   Body: (optional) Custom test data
 */

import { NextResponse } from "next/server";
import type { VivaSheetRow } from "@/lib/types/vapi";
import { parseTranscript } from "@/lib/utils/transcript-parser";
import { evaluateViva } from "@/lib/utils/viva-evaluator";
import { saveToSheets, formatEvaluationForSheet } from "@/lib/utils/sheets";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    
    // Use provided data or defaults
    const callId = body.callId || `test-call-${Date.now()}`;
    const studentEmail = body.email || "test@example.com";
    const studentName = body.name || "Test Student";
    const subject = body.subject || "Data Structures";
    const topics = body.topics || "Arrays, Linked Lists, Trees";
    
    // Create a test transcript
    const testTranscript = body.transcript || `AI: Welcome to your viva examination. Let's begin with the first question.

Student: Hello, I'm ready.

AI: What is a data structure? Can you explain the concept?

Student: A data structure is a way of organizing and storing data in a computer so that it can be accessed and modified efficiently. It provides a means to manage large amounts of data effectively.

AI: Good. Can you explain the difference between an array and a linked list?

Student: An array is a collection of elements stored in contiguous memory locations. It allows random access to elements using indices. A linked list is a collection of nodes where each node contains data and a reference to the next node. Linked lists allow dynamic memory allocation but require sequential access.

AI: Excellent. What are the time complexities for searching in an array versus a linked list?

Student: For an array, searching takes O(n) time in the worst case if we need to check each element. For a linked list, searching also takes O(n) time because we need to traverse from the head to find the element. However, arrays allow binary search if sorted, which is O(log n).

AI: Very good. That concludes our examination. Thank you for your time.`;

    console.log("[Test Webhook] ===== TEST WEBHOOK CALLED =====");
    console.log("[Test Webhook] Student:", studentName, studentEmail);
    console.log("[Test Webhook] Subject:", subject);
    console.log("[Test Webhook] Topics:", topics);

    // Parse transcript into Q&A pairs
    console.log("[Test Webhook] Parsing transcript...");
    console.log("[Test Webhook] Transcript length:", testTranscript.length);
    console.log("[Test Webhook] Transcript preview (first 500 chars):", testTranscript.substring(0, 500));
    console.log("[Test Webhook] Transcript lines:", testTranscript.split("\n").length);
    console.log("[Test Webhook] Has AI prefix:", /^AI:/m.test(testTranscript));
    console.log("[Test Webhook] Has Student prefix:", /^Student:/m.test(testTranscript));
    const parsedTranscript = parseTranscript(testTranscript);
    console.log(`[Test Webhook] Found ${parsedTranscript.questions.length} Q&A pairs`);
    if (parsedTranscript.questions.length > 0) {
      parsedTranscript.questions.forEach((qa, idx) => {
        console.log(`[Test Webhook] Q${idx + 1}: "${qa.question.substring(0, 80)}..."`);
        console.log(`[Test Webhook] A${idx + 1}: "${qa.answer.substring(0, 80)}..."`);
      });
    } else {
      console.warn("[Test Webhook] WARNING: No Q&A pairs found!");
      console.warn("[Test Webhook] Full transcript:", testTranscript);
    }

    // Evaluate
    let evaluation;
    if (parsedTranscript.questions.length === 0) {
      console.warn("[Test Webhook] No Q&A pairs found - creating empty evaluation");
      evaluation = {
        marks: [],
        feedback: [],
        totalMarks: 0,
        maxTotalMarks: 0,
        percentage: 0,
        overallFeedback: "No Q&A pairs could be extracted from the transcript.",
      };
    } else {
      try {
        evaluation = await evaluateViva(parsedTranscript.questions, subject);
        console.log(`[Test Webhook] Evaluation complete: ${evaluation.totalMarks}/${evaluation.maxTotalMarks} (${evaluation.percentage}%)`);
      } catch (evalError) {
        console.error("[Test Webhook] Evaluation failed:", evalError);
        evaluation = {
          marks: parsedTranscript.questions.map((qa, idx) => ({
            questionNumber: idx + 1,
            question: qa.question,
            answer: qa.answer,
            marks: 0,
            maxMarks: 3,
          })),
          feedback: parsedTranscript.questions.map((qa, idx) => ({
            questionNumber: idx + 1,
            feedback: "Evaluation failed - please review manually",
          })),
          totalMarks: 0,
          maxTotalMarks: parsedTranscript.questions.length * 3,
          percentage: 0,
          overallFeedback: `Evaluation encountered an error: ${evalError instanceof Error ? evalError.message : "Unknown error"}`,
        };
      }
    }

    // Format evaluation JSON
    let evaluationJson: string;
    try {
      evaluationJson = formatEvaluationForSheet(evaluation);
      JSON.parse(evaluationJson);
      console.log("[Test Webhook] Evaluation JSON formatted successfully");
    } catch (jsonError) {
      console.error("[Test Webhook] Failed to format evaluation:", jsonError);
      evaluationJson = JSON.stringify(evaluation, null, 2);
    }

    // Prepare sheet row
    const sheetRow: VivaSheetRow = {
      timestamp: new Date().toISOString(),
      callId: callId, // Use provided callId or generate test one
      studentEmail,
      studentName,
      subject,
      topics,
      duration: 600, // 10 minutes
      totalMarks: evaluation.totalMarks,
      maxTotalMarks: evaluation.maxTotalMarks,
      percentage: evaluation.percentage,
      transcript: testTranscript.substring(0, 50000),
      recordingUrl: body.recordingUrl || "https://example.com/test-recording.mp3",
      evaluation: evaluationJson,
    };

    // Save to Google Sheets
    console.log("[Test Webhook] Saving to Google Sheets...");
    const sheetsResult = await saveToSheets(sheetRow);

    if (!sheetsResult.success) {
      console.error("[Test Webhook] Failed to save to sheets:", sheetsResult.error);
      return NextResponse.json(
        {
          success: false,
          error: sheetsResult.error,
          evaluation: {
            totalMarks: evaluation.totalMarks,
            maxTotalMarks: evaluation.maxTotalMarks,
            percentage: evaluation.percentage,
          },
          sheetsSaved: false,
        },
        { status: 500 }
      );
    }

    console.log("[Test Webhook] ✓ Successfully saved to Google Sheets");

    return NextResponse.json({
      success: true,
      message: "Test webhook processed successfully",
      callId: sheetRow.callId,
      evaluation: {
        totalMarks: evaluation.totalMarks,
        maxTotalMarks: evaluation.maxTotalMarks,
        percentage: evaluation.percentage,
        questionsCount: evaluation.marks.length,
      },
      sheetsSaved: true,
      student: {
        email: studentEmail,
        name: studentName,
      },
      subject,
      topics,
    });
  } catch (error) {
    console.error("[Test Webhook] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Test VAPI Webhook Endpoint",
    usage: {
      method: "POST",
      description: "Send a POST request to test the webhook handler",
      example: {
        email: "test@example.com",
        name: "Test Student",
        subject: "Data Structures",
        topics: "Arrays, Linked Lists",
        transcript: "AI: Question...\nStudent: Answer...",
      },
    },
  });
}
