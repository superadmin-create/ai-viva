/**
 * Google Sheets integration for saving viva results
 * Uses Replit's Google Sheets connector for OAuth-based authentication
 */

import { google } from "googleapis";
import type { VivaSheetRow, VivaEvaluation } from "@/lib/types/vapi";

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('Replit connector token not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

async function getGoogleSheetsClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

/**
 * Extract Google Sheet ID from URL or return as-is if already an ID
 */
function extractSheetId(input: string): string {
  if (!input) return input;
  
  if (!input.includes('/') && !input.includes('http')) {
    return input;
  }
  
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  return input;
}

/**
 * Get Sheet ID from environment
 */
function getSheetId(): string | null {
  const sheetIdInput = process.env.GOOGLE_SHEET_ID;
  if (!sheetIdInput) {
    console.warn("[Sheets] GOOGLE_SHEET_ID not configured");
    return null;
  }
  return extractSheetId(sheetIdInput);
}

/**
 * Format timestamp to readable date/time
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Format score as percentage out of 100
 */
function formatScoreOutOf100(percentage: number): string {
  return `${Math.round(percentage)}/100`;
}

const SHEET_NAME = "Viva Results";

async function ensureHeaders(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string
): Promise<void> {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    const sheetExists = spreadsheet.data.sheets?.some(
      (sheet) => sheet.properties?.title === SHEET_NAME
    );

    if (!sheetExists) {
      console.log(`[Sheets] Sheet '${SHEET_NAME}' does not exist, creating it...`);
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: sheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: SHEET_NAME,
                },
              },
            }],
          },
        });
        console.log(`[Sheets] ✓ Created new sheet: ${SHEET_NAME}`);
      } catch (e: any) {
        console.error(`[Sheets] ✗ Failed to create sheet:`, e.message);
        throw new Error(`Cannot create sheet '${SHEET_NAME}': ${e.message}`);
      }
    } else {
      console.log(`[Sheets] ✓ Sheet '${SHEET_NAME}' exists`);
    }

    let firstRow: any[] | undefined;
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${SHEET_NAME}'!A1:K1`,
      });
      firstRow = response.data.values?.[0];
    } catch (e: any) {
      console.log(`[Sheets] Sheet is empty or headers don't exist yet`);
    }

    if (!firstRow || firstRow.length === 0 || firstRow[0] !== "Date & Time") {
      console.log(`[Sheets] Creating headers in '${SHEET_NAME}'...`);
      const headers = [
        "Date & Time",
        "Student Name",
        "Email",
        "Subject",
        "Topics",
        "Questions Answered",
        "Score (out of 100)",
        "Overall Feedback",
        "Transcript",
        "Recording",
        "Evaluation (JSON)",
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${SHEET_NAME}'!A1:K1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [headers],
        },
      });

      console.log(`[Sheets] ✓ Created headers in ${SHEET_NAME}`);
    } else {
      console.log(`[Sheets] ✓ Headers already exist in ${SHEET_NAME}`);
    }
  } catch (error) {
    console.error("[Sheets] Error in ensureHeaders:", error);
  }
}

async function callIdExists(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string,
  callId: string
): Promise<boolean> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${SHEET_NAME}'!A:K`,
    });

    const rows = response.data.values || [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowText = row.join(" ");
      if (rowText.includes(callId)) {
        console.log(`[Sheets] Call ID ${callId} already exists in row ${i + 1}`);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.warn("[Sheets] Could not check for duplicate call ID:", error);
    return false;
  }
}

/**
 * Save viva results to Google Sheets
 */
export async function saveToSheets(
  row: VivaSheetRow
): Promise<{ success: boolean; error?: string }> {
  const sheetId = getSheetId();
  if (!sheetId) {
    console.error("[Sheets] GOOGLE_SHEET_ID not configured");
    return { success: false, error: "GOOGLE_SHEET_ID not configured" };
  }

  try {
    console.log("[Sheets] ===== Starting save to Google Sheets =====");
    console.log("[Sheets] Sheet ID:", sheetId);
    console.log("[Sheets] Authenticating via Replit Google Sheets connector...");

    const sheets = await getGoogleSheetsClient();
    console.log("[Sheets] ✓ Authentication successful");

    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
      });
      console.log("[Sheets] ✓ Spreadsheet found:", spreadsheet.data.properties?.title || "Untitled");
    } catch (spreadsheetError: any) {
      console.error("[Sheets] ✗ Cannot access spreadsheet:", spreadsheetError.message);
      if (spreadsheetError.message?.includes("not found")) {
        throw new Error(`Spreadsheet not found. Check GOOGLE_SHEET_ID: ${sheetId}`);
      } else if (spreadsheetError.message?.includes("permission") || spreadsheetError.message?.includes("PERMISSION_DENIED")) {
        throw new Error(`Permission denied. Grant access to the spreadsheet.`);
      }
      throw spreadsheetError;
    }

    console.log("[Sheets] Ensuring headers exist in sheet:", SHEET_NAME);
    await ensureHeaders(sheets, sheetId);
    console.log("[Sheets] ✓ Headers verified/created");

    console.log("[Sheets] Checking for duplicate call ID:", row.callId);
    const alreadyExists = await callIdExists(sheets, sheetId, row.callId);
    if (alreadyExists) {
      console.warn(`[Sheets] ⚠️  Call ID ${row.callId} already exists in sheet. Skipping duplicate save.`);
      return { 
        success: true, 
        error: "Call ID already exists - duplicate save prevented" 
      };
    }
    console.log("[Sheets] ✓ Call ID is unique, proceeding with save");

    let evaluation: VivaEvaluation | null = null;
    try {
      if (row.evaluation) {
        evaluation = JSON.parse(row.evaluation);
      }
    } catch {
      console.warn("[Sheets] Could not parse evaluation JSON");
    }

    const questionsAnswered = evaluation?.marks?.length || 0;
    const questionsText = questionsAnswered > 0
      ? `${questionsAnswered} questions`
      : "No questions answered";

    const truncatedTranscript = row.transcript
      ? row.transcript.substring(0, 49000)
      : "-";

    let evaluationJson = "";
    if (row.evaluation) {
      evaluationJson = typeof row.evaluation === 'string' 
        ? row.evaluation 
        : JSON.stringify(row.evaluation);
    } else if (evaluation) {
      evaluationJson = JSON.stringify(evaluation);
    }

    const scoreDisplay = formatScoreOutOf100(row.percentage);
    const overallFeedback = evaluation?.overallFeedback || "No feedback available";
    
    console.log("[Sheets] Evaluation Summary:", {
      questionsCount: questionsAnswered,
      totalMarks: evaluation?.totalMarks || 0,
      maxMarks: evaluation?.maxTotalMarks || 0,
      percentage: row.percentage,
      scoreDisplay,
    });

    const rowValues = [
      formatTimestamp(row.timestamp),
      row.studentName || "Unknown",
      row.studentEmail || "unknown@example.com",
      row.subject || "Unknown Subject",
      row.topics || "-",
      questionsText,
      scoreDisplay,
      overallFeedback,
      truncatedTranscript,
      row.recordingUrl || "-",
      evaluationJson,
    ];

    console.log("[Sheets] Appending row to sheet...");
    
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `'${SHEET_NAME}'!A:K`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [rowValues],
      },
    });

    if (response.data.updates) {
      console.log("[Sheets] ✓ Successfully saved to Google Sheets!");
      console.log("[Sheets] Updated range:", response.data.updates.updatedRange);
      return { success: true };
    } else {
      console.warn("[Sheets] ⚠ Append completed but no update info in response");
      return { success: true };
    }
  } catch (error) {
    console.error("[Sheets] ===== ERROR SAVING TO GOOGLE SHEETS =====");
    console.error("[Sheets] Error details:", error);

    let errorMessage = "Unknown error";
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    console.error("[Sheets] Error message:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Format evaluation data for sheet storage
 */
export function formatEvaluationForSheet(
  evaluation: VivaEvaluation
): string {
  return JSON.stringify(evaluation, null, 2);
}
