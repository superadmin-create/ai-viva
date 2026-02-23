import { NextResponse } from "next/server";
import type { VivaSheetRow } from "@/lib/types/vapi";
import { parseTranscript } from "@/lib/utils/transcript-parser";
import { evaluateViva } from "@/lib/utils/viva-evaluator";
import { saveToSheets, formatEvaluationForSheet } from "@/lib/utils/sheets";
import { saveToAdminDb, lookupTeacherEmail } from "@/lib/utils/admin-db";
import { verifyVapiWebhookSignature } from "@/lib/utils/webhook-signature";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

interface VapiWebhookMessage {
  message?: {
    type?: string;
    call?: any;
    transcript?: string;
    summary?: string;
    endedReason?: string;
    metadata?: Record<string, any>;
    analysis?: {
      summary?: string;
      structuredData?: Record<string, any>;
      successEvaluation?: any;
    };
    artifact?: {
      transcript?: string;
      messages?: any[];
      recordingUrl?: string;
    };
  };
  call?: any;
}

export async function POST(request: Request) {
  const startTime = Date.now();
  
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    
    // Log the raw payload to understand what Vapi is sending
    console.log("[Viva Complete] ===== WEBHOOK RECEIVED =====");
    console.log("[Viva Complete] Timestamp:", new Date().toISOString());
    console.log("[Viva Complete] Raw payload length:", rawBody.length);
    console.log("[Viva Complete] Raw payload (first 2000 chars):", rawBody.substring(0, 2000));
    
    const body: VapiWebhookMessage = JSON.parse(rawBody);
    
    // Log the parsed structure comprehensively
    console.log("[Viva Complete] Payload keys:", Object.keys(body));
    console.log("[Viva Complete] Message type:", body.message?.type);
    console.log("[Viva Complete] Has message object:", !!body.message);
    console.log("[Viva Complete] Has call at root:", !!body.call);
    console.log("[Viva Complete] Message keys:", body.message ? Object.keys(body.message) : []);
    
    // Log full structure for debugging
    console.log("[Viva Complete] Full payload structure:", JSON.stringify({
      hasMessage: !!body.message,
      hasCall: !!body.call,
      messageType: body.message?.type,
      callStatus: body.call?.status || body.message?.call?.status,
      hasTranscript: !!(body.call?.transcript || body.message?.transcript || body.message?.artifact?.transcript),
    }, null, 2));

    // Verify webhook signature (security)
    const signature = request.headers.get("x-vapi-signature");
    const webhookSecret = process.env.VAPI_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const isValid = verifyVapiWebhookSignature(
        rawBody,
        signature,
        webhookSecret
      );

      if (!isValid) {
        console.error("[Viva Complete] Invalid webhook signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
      console.log("[Viva Complete] Webhook signature verified");
    }

    // Handle different Vapi message types
    const messageType = body.message?.type;
    
    // Extract call data - Vapi sends it in different places
    // Try multiple possible locations for call data
    const call = body.message?.call || 
                 body.call || 
                 (body as any).data?.call ||
                 (body as any).event?.call;
    const artifact = body.message?.artifact || 
                     (body as any).artifact ||
                     (body as any).data?.artifact;
    
    // Log where we found the call data
    if (call) {
      const callSource = body.message?.call ? "body.message.call" :
                        body.call ? "body.call" :
                        (body as any).data?.call ? "body.data.call" :
                        (body as any).event?.call ? "body.event.call" : "unknown";
      console.log("[Viva Complete] Found call data at:", callSource);
    }
    
    // Check if this is an end-of-call event that we should process
    // Process if:
    // 1. Message type is "end-of-call-report" (explicit end event)
    // 2. Call status is "ended" or "completed" (call has finished)
    // 3. Call exists (we'll process even without transcript - can save what we have)
    const callStatus = call?.status;
    const isEndOfCall = messageType === "end-of-call-report" || 
                        callStatus === "ended" || 
                        callStatus === "completed";
    const hasCall = !!call;
    const hasTranscript = !!(call?.transcript || artifact?.transcript || artifact?.messages);
    
    // Log what we received for debugging
    console.log("[Viva Complete] Webhook analysis:", {
      messageType: messageType || "none",
      callStatus: callStatus || "unknown",
      hasCall,
      hasTranscript,
      isEndOfCall,
      callId: call?.id || "none",
    });
    
    // For assistant-request, always return empty object
    if (messageType === "assistant-request") {
      console.log("[Viva Complete] Assistant request - returning empty object");
      return NextResponse.json({});
    }
    
    // CRITICAL: Only process end-of-call events to prevent duplicate saves
    // VAPI may send multiple webhook events (status-update, transcript, etc.)
    // We only want to process the final end-of-call-report
    if (messageType && !isEndOfCall) {
      console.log(`[Viva Complete] Received ${messageType} event - not an end-of-call event, acknowledging and skipping`);
      return NextResponse.json({ received: true, type: messageType, note: "Not an end-of-call event, skipping processing" });
    }
    
    // For non-end-of-call events without call data, acknowledge and return
    if (messageType && !isEndOfCall && !hasCall) {
      console.log(`[Viva Complete] Received ${messageType} event without call data - acknowledging`);
      return NextResponse.json({ received: true, type: messageType });
    }

    // CRITICAL: If we don't have a call object, we can't process
    if (!hasCall) {
      console.log("[Viva Complete] No call object in payload");
      console.log("[Viva Complete] Message type:", messageType);
      console.log("[Viva Complete] Full payload keys:", Object.keys(body));
      console.log("[Viva Complete] Full payload (first 2000 chars):", JSON.stringify(body, null, 2).substring(0, 2000));
      return NextResponse.json({ received: true, note: "No call data to process" });
    }

    // IMPORTANT: Process the call even if transcript is missing
    // We'll save what we have and note that transcript is missing
    if (!hasTranscript) {
      console.warn("[Viva Complete] WARNING: Call ended but no transcript found in payload");
      console.warn("[Viva Complete] This may be normal if VAPI sends multiple webhooks");
      console.warn("[Viva Complete] Will still attempt to save call metadata");
    }

    // Log what we're processing
    console.log("[Viva Complete] Processing call completion");
    console.log("[Viva Complete] Message type:", messageType || "none");
    console.log("[Viva Complete] Call status:", callStatus || "unknown");
    console.log("[Viva Complete] Is end of call:", isEndOfCall);

    const callId = call.id || `unknown-${Date.now()}`;
    console.log(`[Viva Complete] Processing call ${callId}`);

    console.log("[Viva Complete] Full call object keys:", Object.keys(call));
    console.log("[Viva Complete] call.metadata:", JSON.stringify(call.metadata, null, 2));
    console.log("[Viva Complete] call.assistantOverrides:", JSON.stringify(call.assistantOverrides, null, 2));

    const vapiAnalysis = body.message?.analysis;
    const vapiStructuredData = vapiAnalysis?.structuredData || {};
    console.log("[Viva Complete] VAPI analysis:", JSON.stringify(vapiAnalysis, null, 2));
    console.log("[Viva Complete] VAPI structuredData:", JSON.stringify(vapiStructuredData, null, 2));

    const metadata =
      call.metadata ||
      call.assistantOverrides?.metadata ||
      call.assistant?.metadata ||
      body.message?.metadata ||
      {};

    const variableValues = call.assistantOverrides?.variableValues || {};

    console.log("[Viva Complete] Extracted metadata:", JSON.stringify(metadata, null, 2));
    console.log("[Viva Complete] Variable values:", JSON.stringify(variableValues, null, 2));
    
    // Log all possible email locations for debugging
    console.log("[Viva Complete] Email search locations:");
    console.log("  - metadata.studentEmail:", metadata.studentEmail);
    console.log("  - variableValues.studentEmail:", variableValues.studentEmail);
    console.log("  - call.customer?.number:", call.customer?.number);
    console.log("  - call.customer?.email:", call.customer?.email);
    console.log("  - call.assistantOverrides?.variableValues?.studentEmail:", call.assistantOverrides?.variableValues?.studentEmail);

    // PRIORITY: Customer object is most reliable (persists through webhooks)
    // Then metadata, then variableValues as fallback
    const studentEmail = 
      call.customer?.email ||
      metadata.studentEmail || 
      variableValues.studentEmail || 
      call.assistantOverrides?.variableValues?.studentEmail ||
      "";
    const studentName = 
      call.customer?.name ||
      metadata.studentName || 
      variableValues.studentName || 
      call.assistantOverrides?.variableValues?.studentName ||
      "Unknown";
    const subject = metadata.subject || variableValues.subject || call.assistantOverrides?.variableValues?.subject || "Unknown Subject";
    const topics = metadata.topics || variableValues.topics || call.assistantOverrides?.variableValues?.topics || "";

    console.log("[Viva Complete] Final student data:", { studentEmail, studentName, subject, topics });

    if (!studentEmail) {
      console.warn("[Viva Complete] No student email in metadata");
    }

    // Extract transcript - prioritize most accurate sources
    // Vapi provides transcripts in multiple formats, we want the most complete one
    let transcript = "";
    
    // Priority order for transcript sources (most accurate first):
    // 1. Artifact messages (most detailed, includes all turns)
    // 2. Call transcript (official transcript)
    // 3. Message transcript (fallback)
    
    if (artifact?.messages && Array.isArray(artifact.messages)) {
      // Build transcript from messages array - this is usually the most accurate
      const messageLines = artifact.messages
        .filter((msg: any) => {
          // Exclude system messages and empty messages
          const role = msg.role || "";
          const content = msg.content || msg.message || msg.text || "";
          return role !== "system" && content.trim().length > 0;
        })
        .map((msg: any) => {
          const role = msg.role || "";
          const content = msg.content || msg.message || msg.text || "";
          
          // Normalize role names
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
        .filter((line: string | null) => line !== null);
      
      transcript = messageLines.join("\n");
      console.log("[Viva Complete] Built transcript from messages array (excluding system messages)");
      console.log(`[Viva Complete] Processed ${artifact.messages.length} messages into ${messageLines.length} transcript lines`);
    } else {
      // Fallback to other transcript sources
      transcript = 
        call.transcript || 
        artifact?.transcript ||
        body.message?.transcript ||
        "";
    }

    // Log transcript details for debugging
    console.log("[Viva Complete] Transcript length:", transcript.length);
    console.log("[Viva Complete] Transcript preview:", transcript.substring(0, 500));
    console.log("[Viva Complete] Transcript line count:", transcript.split("\n").length);
    
    if (!transcript || transcript.trim().length === 0) {
      console.warn("[Viva Complete] No transcript found in call data");
      console.warn("[Viva Complete] Available data:", {
        hasCall: !!call,
        hasArtifact: !!artifact,
        callKeys: call ? Object.keys(call) : [],
        artifactKeys: artifact ? Object.keys(artifact) : [],
      });
    } else {
      // Validate transcript has both AI and Student messages
      const hasAI = /^(?:AI|bot|assistant|examiner):/im.test(transcript);
      const hasStudent = /^(?:Student|user|candidate):/im.test(transcript);
      console.log(`[Viva Complete] Transcript validation: Has AI messages: ${hasAI}, Has Student messages: ${hasStudent}`);
      
      if (!hasAI || !hasStudent) {
        console.warn("[Viva Complete] Transcript may be incomplete - missing AI or Student messages");
      }
    }

    // PRIORITY: Use evaluation data from VAPI's structuredData if available
    // VAPI sends structured data which may contain evaluation, teacher_email, marks_breakdown
    // Format varies: could be {evaluation: {...}, teacher_email, marks_breakdown}
    // OR category-based: {depth: 65, clarity: 80, knowledge: 70, strengths: [...], improvements: [...]}
    let evaluation: any;
    let vapiProvidedEvaluation = false;

    const hasVapiStructuredData = Object.keys(vapiStructuredData).length > 0;
    const vapiTeacherEmail = vapiStructuredData.teacher_email || vapiStructuredData.teacherEmail;

    if (hasVapiStructuredData) {
      console.log("[Viva Complete] Found VAPI structuredData with keys:", Object.keys(vapiStructuredData));
      vapiProvidedEvaluation = true;

      const vapiEvaluation = vapiStructuredData.evaluation || vapiStructuredData.evaluationJson || vapiStructuredData.evaluation_json;
      const vapiMarksBreakdown = vapiStructuredData.marks_breakdown || vapiStructuredData.marksBreakdown;

      let parsedVapiEval: any = {};
      if (vapiEvaluation) {
        if (typeof vapiEvaluation === "string") {
          try { parsedVapiEval = JSON.parse(vapiEvaluation); } catch { parsedVapiEval = {}; }
        } else if (typeof vapiEvaluation === "object") {
          parsedVapiEval = vapiEvaluation;
        }
      }

      const marksSource = vapiMarksBreakdown || parsedVapiEval.marks || parsedVapiEval.marks_breakdown || vapiStructuredData.marks;
      const parsedMarks = typeof marksSource === "string" ? (() => { try { return JSON.parse(marksSource); } catch { return []; } })() : (Array.isArray(marksSource) ? marksSource : []);

      const totalMarks = parsedVapiEval.totalMarks ?? parsedVapiEval.total_marks ?? parsedVapiEval.score
        ?? vapiStructuredData.totalMarks ?? vapiStructuredData.total_marks ?? vapiStructuredData.score ?? 0;
      const maxTotalMarks = parsedVapiEval.maxTotalMarks ?? parsedVapiEval.max_total_marks ?? parsedVapiEval.maxMarks
        ?? vapiStructuredData.maxTotalMarks ?? vapiStructuredData.max_total_marks ?? 0;
      let percentage = parsedVapiEval.percentage ?? vapiStructuredData.percentage ?? 0;
      if (percentage === 0 && maxTotalMarks > 0) {
        percentage = Math.round((totalMarks / maxTotalMarks) * 100);
      }

      const overallFeedback = parsedVapiEval.overallFeedback ?? parsedVapiEval.overall_feedback
        ?? vapiStructuredData.overallFeedback ?? vapiStructuredData.overall_feedback
        ?? vapiAnalysis?.summary ?? "";

      const strengths = parsedVapiEval.strengths || vapiStructuredData.strengths || [];
      const improvements = parsedVapiEval.improvements || vapiStructuredData.improvements || [];

      let finalMarks = parsedMarks;

      if (finalMarks.length === 0 && transcript) {
        const parsedTranscript = parseTranscript(transcript);
        if (parsedTranscript.questions.length > 0) {
          const vapiScore = totalMarks || vapiStructuredData.score || 0;
          const questionCount = parsedTranscript.questions.length;
          const maxMarksPerQ = 10;
          const avgMarksPerQ = vapiScore > 0 ? Math.min(Math.round((vapiScore / 100) * maxMarksPerQ), maxMarksPerQ) : 0;

          finalMarks = parsedTranscript.questions.map((qa: any, idx: number) => ({
            questionNumber: idx + 1,
            question: qa.question,
            answer: qa.answer,
            marks: avgMarksPerQ,
            maxMarks: maxMarksPerQ,
          }));

          console.log(`[Viva Complete] Built per-question marks from transcript: ${finalMarks.length} questions, ${avgMarksPerQ}/${maxMarksPerQ} each`);
        }
      }

      const computedOverallFeedback = typeof overallFeedback === "string" ? overallFeedback :
        (Array.isArray(strengths) && strengths.length > 0
          ? `Strengths: ${strengths.join(", ")}. Improvements: ${improvements.join(", ")}`
          : JSON.stringify(overallFeedback));

      evaluation = {
        marks: finalMarks,
        feedback: parsedVapiEval.feedback || [],
        totalMarks,
        maxTotalMarks,
        percentage,
        overallFeedback: computedOverallFeedback,
        vapiRawEvaluation: vapiStructuredData,
      };

      if (finalMarks.length > 0) {
        evaluation.maxTotalMarks = finalMarks.reduce((sum: number, m: any) => sum + (m.maxMarks || m.max_marks || 10), 0);
        evaluation.totalMarks = finalMarks.reduce((sum: number, m: any) => sum + (m.marks || m.score || 0), 0);
        evaluation.percentage = evaluation.maxTotalMarks > 0
          ? Math.round((evaluation.totalMarks / evaluation.maxTotalMarks) * 100) : 0;
      }

      console.log(`[Viva Complete] VAPI evaluation: ${evaluation.totalMarks}/${evaluation.maxTotalMarks} (${evaluation.percentage}%)`);
      console.log(`[Viva Complete] Marks breakdown items: ${finalMarks.length}`);
      console.log(`[Viva Complete] VAPI raw evaluation stored for reference`);
    } else {
      console.log("[Viva Complete] No VAPI structuredData, falling back to local evaluation");

      const parsedTranscript = parseTranscript(transcript);
      console.log(`[Viva Complete] Found ${parsedTranscript.questions.length} Q&A pairs from transcript`);

      if (parsedTranscript.questions.length === 0) {
        evaluation = {
          marks: [],
          feedback: [],
          totalMarks: 0,
          maxTotalMarks: 0,
          percentage: 0,
          overallFeedback: "No Q&A pairs could be extracted from the transcript. Please review the transcript manually.",
        };
      } else {
        try {
          evaluation = await evaluateViva(parsedTranscript.questions, subject);
          console.log(`[Viva Complete] Local evaluation: ${evaluation.totalMarks}/${evaluation.maxTotalMarks} (${evaluation.percentage}%)`);
        } catch (evalError) {
          console.error("[Viva Complete] Local evaluation failed:", evalError);
          evaluation = {
            marks: parsedTranscript.questions.map((qa: any, idx: number) => ({
              questionNumber: idx + 1, question: qa.question, answer: qa.answer, marks: 0, maxMarks: 10,
            })),
            feedback: parsedTranscript.questions.map((_: any, idx: number) => ({
              questionNumber: idx + 1, feedback: "Evaluation failed - please review manually",
            })),
            totalMarks: 0,
            maxTotalMarks: parsedTranscript.questions.length * 10,
            percentage: 0,
            overallFeedback: `Evaluation error: ${evalError instanceof Error ? evalError.message : "Unknown error"}`,
          };
        }
      }
    }

    // Prepare data for Google Sheets
    const timestamp = new Date().toISOString();
    const duration = call.duration || 0; // Duration in seconds

    // Get recording URL from various places
    const recordingUrl = call.recordingUrl || artifact?.recordingUrl || "";

    // Format evaluation for sheet storage - ensure it's valid JSON
    let evaluationJson: string;
    try {
      evaluationJson = formatEvaluationForSheet(evaluation);
      // Validate it's valid JSON by parsing it back
      JSON.parse(evaluationJson);
      console.log("[Viva Complete] Evaluation JSON formatted successfully, length:", evaluationJson.length);
    } catch (jsonError) {
      console.error("[Viva Complete] ERROR: Failed to format evaluation as JSON:", jsonError);
      // Fallback to stringified version
      evaluationJson = JSON.stringify(evaluation, null, 2);
      console.log("[Viva Complete] Using fallback JSON stringification");
    }

    // Save evaluation JSON to file for backup
    try {
      const evaluationsDir = join(process.cwd(), "evaluations");
      await mkdir(evaluationsDir, { recursive: true });
      const fileName = `evaluation-${callId}-${Date.now()}.json`;
      const filePath = join(evaluationsDir, fileName);
      await writeFile(filePath, evaluationJson, "utf-8");
      console.log(`[Viva Complete] ✓ Saved evaluation JSON to: ${filePath}`);
    } catch (fileError) {
      console.warn("[Viva Complete] Could not save evaluation JSON to file:", fileError);
      // Don't fail if file save fails
    }

    let teacherEmail = vapiTeacherEmail || metadata.teacherEmail || variableValues.teacherEmail || "";
    if (!teacherEmail && subject) {
      teacherEmail = await lookupTeacherEmail(subject);
    }
    console.log("[Viva Complete] Teacher email resolved:", teacherEmail, vapiProvidedEvaluation ? "(from VAPI)" : "(from metadata/lookup)");

    let marksBreakdownJson = "";
    if (evaluation.marks?.length > 0) {
      marksBreakdownJson = JSON.stringify(evaluation.marks);
    }

    const sheetRow: VivaSheetRow = {
      timestamp,
      callId: callId,
      studentEmail: studentEmail || "unknown@example.com",
      studentName,
      subject,
      topics,
      duration,
      totalMarks: evaluation.totalMarks,
      maxTotalMarks: evaluation.maxTotalMarks,
      percentage: evaluation.percentage,
      transcript: transcript.substring(0, 50000),
      recordingUrl: recordingUrl,
      evaluation: evaluationJson,
      teacherEmail,
      marksBreakdown: marksBreakdownJson,
    };
    
    // Validate sheet row has all required data
    console.log("[Viva Complete] Validating sheet row data...");
    if (!sheetRow.studentEmail || sheetRow.studentEmail === "unknown@example.com") {
      console.warn("[Viva Complete] WARNING: Student email is missing or default");
    }
    
    // Validate evaluation was generated
    console.log("[Viva Complete] Evaluation validation:", {
      hasEvaluation: !!evaluation,
      marksCount: evaluation?.marks?.length || 0,
      feedbackCount: evaluation?.feedback?.length || 0,
      totalMarks: evaluation?.totalMarks || 0,
      maxTotalMarks: evaluation?.maxTotalMarks || 0,
      percentage: evaluation?.percentage || 0,
      hasOverallFeedback: !!evaluation?.overallFeedback,
      evaluationJsonLength: evaluationJson?.length || 0,
    });
    
    if (!sheetRow.evaluation || sheetRow.evaluation.length === 0) {
      console.error("[Viva Complete] ERROR: Evaluation JSON is empty!");
      console.error("[Viva Complete] This means evaluation results will NOT be saved!");
    } else {
      console.log("[Viva Complete] ✓ Sheet row data validated");
      console.log("[Viva Complete] ✓ Evaluation results ready to save:");
      console.log(`   - Questions: ${evaluation.marks.length}`);
      console.log(`   - Score: ${evaluation.totalMarks}/${evaluation.maxTotalMarks} (${evaluation.percentage}%)`);
      console.log(`   - Feedback: ${evaluation.feedback.length} items`);
    }

    // Save to Google Sheets - CRITICAL: This must happen for results to be saved
    console.log("[Viva Complete] ===== SAVING TO GOOGLE SHEETS =====");
    console.log("[Viva Complete] Call ID:", callId);
    console.log("[Viva Complete] Timestamp:", timestamp);
    console.log("[Viva Complete] Sheet row data:", {
      studentEmail: sheetRow.studentEmail,
      studentName: sheetRow.studentName,
      subject: sheetRow.subject,
      topics: sheetRow.topics,
      score: sheetRow.percentage,
      questionsCount: evaluation.marks.length,
      hasEvaluation: !!sheetRow.evaluation,
      evaluationLength: sheetRow.evaluation?.length || 0,
      transcriptLength: sheetRow.transcript.length,
      hasTranscript: sheetRow.transcript.length > 0,
      duration: sheetRow.duration,
    });
    
    // Attempt to save with retry logic
    let sheetsResult: { success: boolean; error?: string } = { success: false, error: "Not attempted" };
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Viva Complete] Attempt ${attempt}/${maxRetries} to save to sheets...`);
        sheetsResult = await saveToSheets(sheetRow);
        
        if (sheetsResult.success) {
          console.log(`[Viva Complete] ✓ Successfully saved to Google Sheets on attempt ${attempt}`);
          console.log("[Viva Complete] Results should now be visible in the 'Viva Results' sheet");
          break;
        } else {
          console.warn(`[Viva Complete] Attempt ${attempt} failed:`, sheetsResult.error);
          if (attempt < maxRetries) {
            console.log(`[Viva Complete] Retrying in 1 second...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (saveError) {
        console.error(`[Viva Complete] Exception during save attempt ${attempt}:`, saveError);
        sheetsResult = {
          success: false,
          error: saveError instanceof Error ? saveError.message : String(saveError),
        };
        if (attempt < maxRetries) {
          console.log(`[Viva Complete] Retrying in 1 second...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!sheetsResult.success) {
      console.error("[Viva Complete] ===== CRITICAL ERROR: FAILED TO SAVE TO SHEETS =====");
      console.error("[Viva Complete] Error after all retries:", sheetsResult.error || "Unknown error");
      console.error("[Viva Complete] This means the results will NOT appear in Google Sheets!");
      console.error("[Viva Complete] Please check:");
      console.error("  1. GOOGLE_PRIVATE_KEY is set correctly in environment variables");
      console.error("  2. GOOGLE_CLIENT_EMAIL is set correctly in environment variables");
      console.error("  3. GOOGLE_SHEET_ID is set correctly in environment variables");
      console.error("  4. Service account email has Editor access to the Google Sheet");
      console.error("  5. The sheet tab 'Viva Results' exists or can be created");
      console.error("[Viva Complete] Call ID:", callId);
      console.error("[Viva Complete] Student Email:", studentEmail);
      console.error("[Viva Complete] ===== END CRITICAL ERROR =====");
      // Don't fail the webhook - log error but return success
      // Sheets save can be retried later if needed, but we've logged all details
    }

    let adminDbSaved = false;
    try {
      let evaluationObj;
      try {
        evaluationObj = typeof evaluationJson === "string" ? JSON.parse(evaluationJson) : evaluation;
      } catch {
        evaluationObj = evaluation;
      }

      const marksBreakdownForDb = evaluation.marks?.length > 0 ? evaluation.marks : [];

      const adminDbResult = await saveToAdminDb({
        timestamp,
        student_name: studentName,
        student_email: studentEmail || "unknown@example.com",
        subject,
        topics,
        questions_answered: evaluation.marks?.length || 0,
        score: evaluation.totalMarks || 0,
        overall_feedback: evaluation.overallFeedback || "",
        transcript: transcript.substring(0, 50000),
        recording_url: recordingUrl,
        evaluation: evaluationObj,
        vapi_call_id: callId,
        teacher_email: teacherEmail,
        marks_breakdown: marksBreakdownForDb,
      });

      adminDbSaved = adminDbResult.success;
      if (adminDbResult.success) {
        console.log("[Viva Complete] Saved to admin database");
      } else {
        console.warn("[Viva Complete] Admin DB save issue:", adminDbResult.error);
      }
    } catch (dbError) {
      console.error("[Viva Complete] Admin DB save error:", dbError);
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `[Viva Complete] Successfully processed call ${callId} in ${processingTime}ms`
    );

    return NextResponse.json({
      success: true,
      callId: callId,
      evaluation: {
        totalMarks: evaluation.totalMarks,
        maxTotalMarks: evaluation.maxTotalMarks,
        percentage: evaluation.percentage,
      },
      sheetsSaved: sheetsResult.success,
      adminDbSaved,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error("[Viva Complete] ===== CRITICAL ERROR IN WEBHOOK PROCESSING =====");
    console.error("[Viva Complete] Error processing webhook:", error);
    
    // Log detailed error information
    if (error instanceof Error) {
      console.error("[Viva Complete] Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
        processingTime,
      });
    } else {
      console.error("[Viva Complete] Error (non-Error object):", JSON.stringify(error, null, 2));
    }
    
    // Note: Can't re-read request body here as it's already been consumed
    // The payload should have been logged at the start of the function
    
    console.error("[Viva Complete] ===== END CRITICAL ERROR =====");

    // Return 500 but don't expose internal errors to Vapi
    // Vapi will retry if it receives a 5xx status
    return NextResponse.json(
      {
        error: "Internal server error",
        message: "Failed to process viva completion",
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/viva-complete",
    message: "Viva completion webhook endpoint is active",
  });
}
