import { NextResponse } from "next/server";
import type { VivaSheetRow } from "@/lib/types/vapi";
import { parseTranscript } from "@/lib/utils/transcript-parser";
import { evaluateViva } from "@/lib/utils/viva-evaluator";
import { saveToSheets, formatEvaluationForSheet } from "@/lib/utils/sheets";
import { saveToAdminDb, lookupTeacherEmail } from "@/lib/utils/admin-db";

const VAPI_API_BASE = "https://api.vapi.ai";

function getVapiKey(): string {
  let key = process.env.VAPI_PRIVATE_KEY || "";
  if (key.includes("=")) {
    key = key.split("=").slice(1).join("=").trim();
  }
  return key.trim();
}

async function fetchVapiCalls(limit: number = 20): Promise<any[]> {
  const privateKey = getVapiKey();
  if (!privateKey) {
    throw new Error("VAPI_PRIVATE_KEY is not set");
  }

  const url = `${VAPI_API_BASE}/call?limit=${limit}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${privateKey}`,
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

async function processCall(call: any): Promise<{
  callId: string;
  status: string;
  result?: string;
  error?: string;
}> {
  const callId = call.id;

  if (call.status !== "ended") {
    return { callId, status: "skipped", result: `Call status: ${call.status}` };
  }

  const metadata = call.metadata || {};
  const variableValues =
    call.assistantOverrides?.variableValues || {};

  const studentEmail =
    call.customer?.email ||
    metadata.studentEmail ||
    variableValues.studentEmail ||
    "";
  const studentName =
    call.customer?.name ||
    metadata.studentName ||
    variableValues.studentName ||
    "Unknown";
  const subject =
    metadata.subject ||
    variableValues.subject ||
    "Unknown Subject";
  const topics =
    metadata.topics || variableValues.topics || "";

  let transcript = "";
  const artifact = call.artifact;

  if (artifact?.messages && Array.isArray(artifact.messages)) {
    const messageLines = artifact.messages
      .filter((msg: any) => {
        const role = msg.role || "";
        const content = msg.content || msg.message || msg.text || "";
        return role !== "system" && content.trim().length > 0;
      })
      .map((msg: any) => {
        const role = msg.role || "";
        const content = msg.content || msg.message || msg.text || "";
        let roleLabel = "Student";
        if (
          role === "bot" ||
          role === "assistant" ||
          role === "ai"
        ) {
          roleLabel = "AI";
        }
        const cleaned = (content || "").trim();
        if (cleaned.length === 0) return null;
        return `${roleLabel}: ${cleaned}`;
      })
      .filter((line: string | null) => line !== null);
    transcript = messageLines.join("\n");
  } else {
    transcript =
      call.transcript || artifact?.transcript || "";
  }

  if (!transcript || transcript.trim().length === 0) {
    return {
      callId,
      status: "skipped",
      result: "No transcript available",
    };
  }

  const parsedTranscript = parseTranscript(transcript);

  let evaluation;
  if (parsedTranscript.questions.length === 0) {
    evaluation = {
      marks: [],
      feedback: [],
      totalMarks: 0,
      maxTotalMarks: 0,
      percentage: 0,
      overallFeedback:
        "No Q&A pairs could be extracted from the transcript.",
    };
  } else {
    try {
      evaluation = await evaluateViva(
        parsedTranscript.questions,
        subject
      );
    } catch {
      evaluation = {
        marks: parsedTranscript.questions.map((qa, idx) => ({
          questionNumber: idx + 1,
          question: qa.question,
          answer: qa.answer,
          marks: 0,
          maxMarks: 10,
        })),
        feedback: parsedTranscript.questions.map((_, idx) => ({
          questionNumber: idx + 1,
          feedback: "Evaluation failed - please review manually",
        })),
        totalMarks: 0,
        maxTotalMarks: parsedTranscript.questions.length * 10,
        percentage: 0,
        overallFeedback: "Evaluation encountered an error.",
      };
    }
  }

  let evaluationJson: string;
  try {
    evaluationJson = formatEvaluationForSheet(evaluation);
  } catch {
    evaluationJson = JSON.stringify(evaluation, null, 2);
  }

  const timestamp =
    call.endedAt || call.startedAt || new Date().toISOString();
  const duration = call.duration || 0;
  const recordingUrl =
    call.recordingUrl || artifact?.recordingUrl || "";

  let teacherEmail = metadata.teacherEmail || variableValues.teacherEmail || "";
  if (!teacherEmail && subject) {
    teacherEmail = await lookupTeacherEmail(subject);
  }

  const marksBreakdownJson = evaluation.marks?.length > 0
    ? JSON.stringify(evaluation.marks)
    : "";

  const sheetRow: VivaSheetRow = {
    timestamp,
    callId,
    studentEmail: studentEmail || "unknown@example.com",
    studentName,
    subject,
    topics,
    duration,
    totalMarks: evaluation.totalMarks,
    maxTotalMarks: evaluation.maxTotalMarks,
    percentage: evaluation.percentage,
    transcript: transcript.substring(0, 50000),
    recordingUrl,
    evaluation: evaluationJson,
    teacherEmail,
    marksBreakdown: marksBreakdownJson,
  };

  const sheetsResult = await saveToSheets(sheetRow);

  let evaluationObj;
  try {
    evaluationObj = typeof sheetRow.evaluation === "string" ? JSON.parse(sheetRow.evaluation) : sheetRow.evaluation;
  } catch {
    evaluationObj = {};
  }

  const adminDbResult = await saveToAdminDb({
    timestamp: sheetRow.timestamp,
    student_name: studentName,
    student_email: studentEmail || "unknown@example.com",
    subject,
    topics,
    questions_answered: evaluation.marks?.length || 0,
    score: evaluation.totalMarks || 0,
    overall_feedback: evaluation.overallFeedback || "",
    transcript: sheetRow.transcript,
    recording_url: sheetRow.recordingUrl || "",
    evaluation: evaluationObj,
    vapi_call_id: callId,
    teacher_email: teacherEmail,
    marks_breakdown: evaluation.marks || [],
  });

  console.log(`[Sync Results] Admin DB save for ${callId}:`, adminDbResult.success ? "success" : adminDbResult.error);

  if (sheetsResult.success) {
    const isDuplicate = sheetsResult.error?.includes("already exists");
    return {
      callId,
      status: isDuplicate ? "already_synced" : "synced",
      result: isDuplicate
        ? "Already in Google Sheets"
        : `Saved: ${studentName} - ${subject} (${evaluation.percentage}%)`,
    };
  } else {
    return {
      callId,
      status: "error",
      error: sheetsResult.error,
    };
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    console.log(`[Sync Results] Fetching last ${limit} VAPI calls...`);
    const calls = await fetchVapiCalls(limit);
    console.log(`[Sync Results] Retrieved ${calls.length} calls`);

    const results = [];
    let synced = 0;
    let skipped = 0;
    let alreadySynced = 0;
    let errors = 0;

    for (const call of calls) {
      try {
        const result = await processCall(call);
        results.push(result);

        if (result.status === "synced") synced++;
        else if (result.status === "already_synced") alreadySynced++;
        else if (result.status === "skipped") skipped++;
        else if (result.status === "error") errors++;

        console.log(
          `[Sync Results] Call ${result.callId}: ${result.status} - ${result.result || result.error || ""}`
        );
      } catch (err) {
        errors++;
        results.push({
          callId: call.id,
          status: "error",
          error:
            err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    console.log(
      `[Sync Results] Done: ${synced} synced, ${alreadySynced} already synced, ${skipped} skipped, ${errors} errors`
    );

    return NextResponse.json({
      success: true,
      summary: {
        total: calls.length,
        newlySynced: synced,
        alreadySynced,
        skipped,
        errors,
      },
      results,
    });
  } catch (error) {
    console.error("[Sync Results] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
