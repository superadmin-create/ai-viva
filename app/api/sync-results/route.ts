import { NextResponse } from "next/server";
import type { VivaSheetRow } from "@/lib/types/vapi";
import { parseTranscript } from "@/lib/utils/transcript-parser";
import { evaluateViva } from "@/lib/utils/viva-evaluator";
import { saveToSheets, formatEvaluationForSheet } from "@/lib/utils/sheets";
import { saveToAdminDb, lookupTeacherEmail } from "@/lib/utils/admin-db";

const VAPI_API_BASE = "https://api.vapi.ai";

function generateQuestionFeedback(answer: string, marks: number): string {
  const answerLen = (answer || "").trim().length;
  if (answerLen < 10) return "No substantial answer provided.";
  if (marks >= 9) return "Excellent answer demonstrating thorough understanding and clear articulation.";
  if (marks >= 7) return "Good answer with solid understanding; could benefit from more detailed examples.";
  if (marks >= 5) return "Adequate answer covering key points; more depth and clarity would strengthen the response.";
  if (marks >= 3) return "Partial answer with some relevant points; needs more comprehensive coverage of the topic.";
  return "Minimal response; further study and preparation on this topic is recommended.";
}

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
  const vapiAnalysis = call.analysis || {};
  const vapiStructuredData = vapiAnalysis.structuredData || {};

  console.log(`[Sync Results] Call ${callId} - VAPI analysis:`, JSON.stringify(vapiAnalysis, null, 2));

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

  // PRIORITY: Use evaluation data from VAPI's structuredData if available
  let evaluation: any;
  let vapiProvidedEval = false;
  const hasVapiStructuredData = Object.keys(vapiStructuredData).length > 0;
  const vapiTeacherEmail = vapiStructuredData.teacher_email || vapiStructuredData.teacherEmail;

  if (hasVapiStructuredData) {
    console.log(`[Sync Results] Call ${callId} - Using VAPI structured data, keys:`, Object.keys(vapiStructuredData));
    vapiProvidedEval = true;

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
      ?? vapiAnalysis.summary ?? "";

    const strengths = parsedVapiEval.strengths || vapiStructuredData.strengths || [];
    const improvements = parsedVapiEval.improvements || vapiStructuredData.improvements || [];

    let finalMarks = parsedMarks;

    if (finalMarks.length === 0 && transcript) {
      const parsedTranscript = parseTranscript(transcript);
      if (parsedTranscript.questions.length > 0) {
        const vapiScore = totalMarks || vapiStructuredData.score || 0;
        const maxMarksPerQ = 10;
        const avgMarksPerQ = vapiScore > 0 ? Math.min(Math.round((vapiScore / 100) * maxMarksPerQ), maxMarksPerQ) : 0;

        finalMarks = parsedTranscript.questions.map((qa: any, idx: number) => ({
          questionNumber: idx + 1,
          question: qa.question,
          answer: qa.answer,
          marks: avgMarksPerQ,
          maxMarks: maxMarksPerQ,
        }));

        console.log(`[Sync Results] Built per-question marks from transcript: ${finalMarks.length} questions, ${avgMarksPerQ}/${maxMarksPerQ} each`);
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
  } else {
    console.log(`[Sync Results] Call ${callId} - No VAPI evaluation, using local evaluation`);

    const parsedTranscript = parseTranscript(transcript);

    if (parsedTranscript.questions.length === 0) {
      evaluation = {
        marks: [], feedback: [], totalMarks: 0, maxTotalMarks: 0, percentage: 0,
        overallFeedback: "No Q&A pairs could be extracted from the transcript.",
      };
    } else {
      try {
        evaluation = await evaluateViva(parsedTranscript.questions, subject);
      } catch {
        evaluation = {
          marks: parsedTranscript.questions.map((qa: any, idx: number) => ({
            questionNumber: idx + 1, question: qa.question, answer: qa.answer, marks: 0, maxMarks: 10,
          })),
          feedback: parsedTranscript.questions.map((_: any, idx: number) => ({
            questionNumber: idx + 1, feedback: "Evaluation failed - please review manually",
          })),
          totalMarks: 0, maxTotalMarks: parsedTranscript.questions.length * 10, percentage: 0,
          overallFeedback: "Evaluation encountered an error.",
        };
      }
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

  let teacherEmail = vapiTeacherEmail || metadata.teacherEmail || variableValues.teacherEmail || "";
  if (!teacherEmail && subject) {
    teacherEmail = await lookupTeacherEmail(subject);
  }

  let marksBreakdownJson = "";
  if (evaluation.marks?.length > 0) {
    marksBreakdownJson = JSON.stringify(evaluation.marks);
  }

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

  const cleanEvaluation: any = {};
  if (vapiProvidedEval) {
    cleanEvaluation.depth = vapiStructuredData.depth ?? evaluation.vapiRawEvaluation?.depth ?? 0;
    cleanEvaluation.clarity = vapiStructuredData.clarity ?? evaluation.vapiRawEvaluation?.clarity ?? 0;
    cleanEvaluation.knowledge = vapiStructuredData.knowledge ?? evaluation.vapiRawEvaluation?.knowledge ?? 0;
    cleanEvaluation.strengths = vapiStructuredData.strengths || evaluation.vapiRawEvaluation?.strengths || [];
    cleanEvaluation.improvements = vapiStructuredData.improvements || evaluation.vapiRawEvaluation?.improvements || [];
  } else {
    const pct = evaluation.percentage || 0;
    cleanEvaluation.depth = pct;
    cleanEvaluation.clarity = pct;
    cleanEvaluation.knowledge = pct;
    cleanEvaluation.strengths = [];
    cleanEvaluation.improvements = [];
    if (evaluation.overallFeedback) {
      cleanEvaluation.improvements.push(evaluation.overallFeedback);
    }
  }

  let marksBreakdownForDb = evaluation.marks?.length > 0 ? evaluation.marks : [];
  console.log(`[Sync Results] Initial marks_breakdown from evaluation.marks: ${marksBreakdownForDb.length} items`);

  if (marksBreakdownForDb.length === 0 && transcript && transcript.length > 30) {
    console.log(`[Sync Results] marks_breakdown empty for ${callId}, building from transcript`);
    try {
      const fallbackParsed = parseTranscript(transcript);
      console.log(`[Sync Results] Transcript parsing found ${fallbackParsed.questions.length} Q&A pairs`);
      if (fallbackParsed.questions.length > 0) {
        const fallbackScore = evaluation.totalMarks || cleanEvaluation.depth || 0;
        const perQ = fallbackScore > 0 ? Math.min(Math.round((fallbackScore / 100) * 10), 10) : 5;
        marksBreakdownForDb = fallbackParsed.questions.map((qa: any, idx: number) => ({
          questionNumber: idx + 1,
          question: qa.question,
          answer: qa.answer,
          marks: perQ,
          maxMarks: 10,
          feedback: generateQuestionFeedback(qa.answer, perQ),
        }));
        console.log(`[Sync Results] Built ${marksBreakdownForDb.length} per-question marks with feedback (${perQ}/10 each)`);
      }
    } catch (parseErr) {
      console.error(`[Sync Results] Error parsing transcript for ${callId}:`, parseErr);
    }
  }
  for (const item of marksBreakdownForDb) {
    if (!item.feedback) {
      item.feedback = generateQuestionFeedback(item.answer, item.marks);
    }
  }
  console.log(`[Sync Results] Final marks_breakdown for ${callId}: ${marksBreakdownForDb.length} items`);

  const adminDbResult = await saveToAdminDb({
    timestamp: sheetRow.timestamp,
    student_name: studentName,
    student_email: studentEmail || "unknown@example.com",
    subject,
    topics,
    questions_answered: marksBreakdownForDb.length || evaluation.marks?.length || 0,
    score: evaluation.totalMarks || 0,
    overall_feedback: evaluation.overallFeedback || "",
    transcript: sheetRow.transcript,
    recording_url: sheetRow.recordingUrl || "",
    evaluation: cleanEvaluation,
    vapi_call_id: callId,
    teacher_email: teacherEmail,
    marks_breakdown: marksBreakdownForDb,
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
