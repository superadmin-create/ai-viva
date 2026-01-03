/**
 * Google Sheets integration for saving viva results
 * This uses the Google Sheets API via service account
 */

import { google, Auth } from "googleapis";
import type { VivaSheetRow, VivaEvaluation } from "@/lib/types/vapi";

interface GoogleSheetsConfig {
  privateKey: string;
  clientEmail: string;
  sheetId: string;
}

// Cache the auth client to avoid re-authentication on each request
let cachedAuth: Auth.JWT | null = null;

/**
 * Get Google Sheets configuration from environment variables
 */
function getSheetsConfig(): GoogleSheetsConfig | null {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  // Support both naming conventions
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!privateKey || !clientEmail || !sheetId) {
    console.warn(
      "[Sheets] Google Sheets configuration not found. Required: GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL (or GOOGLE_SERVICE_ACCOUNT_EMAIL), GOOGLE_SHEET_ID"
    );
    return null;
  }

  // Unescape newlines in private key (common issue with env vars)
  const unescapedKey = privateKey.replace(/\\n/g, "\n");

  return {
    privateKey: unescapedKey,
    clientEmail,
    sheetId,
  };
}

/**
 * Get authenticated Google Sheets client
 */
function getAuthClient(config: GoogleSheetsConfig) {
  if (cachedAuth) {
    return cachedAuth;
  }

  cachedAuth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return cachedAuth;
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

/**
 * Ensure the sheet has headers (creates them if missing)
 */
// Sheet name for viva results
const SHEET_NAME = "Viva Results";

async function ensureHeaders(
  sheets: ReturnType<typeof google.sheets>,
  sheetId: string
): Promise<void> {
  try {
    // First, try to create the sheet if it doesn't exist
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
      console.log(`[Sheets] Created new sheet: ${SHEET_NAME}`);
    } catch (e: any) {
      // Sheet already exists - that's fine
      if (!e.message?.includes("already exists")) {
        console.log(`[Sheets] Sheet ${SHEET_NAME} already exists`);
      }
    }

    // Check if first row has headers
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${SHEET_NAME}'!A1:J1`,
    });

    const firstRow = response.data.values?.[0];

    // If no headers exist, create them
    if (!firstRow || firstRow.length === 0 || firstRow[0] !== "Date & Time") {
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
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `'${SHEET_NAME}'!A1:J1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [headers],
        },
      });

      console.log(`[Sheets] Created headers in ${SHEET_NAME}`);
    }
  } catch (error) {
    // If the sheet doesn't exist or there's an error, we'll handle it in the append
    console.warn("[Sheets] Could not check/create headers:", error);
  }
}

/**
 * Save viva results to Google Sheets
 */
export async function saveToSheets(
  row: VivaSheetRow
): Promise<{ success: boolean; error?: string }> {
  const config = getSheetsConfig();
  if (!config) {
    return { success: false, error: "Sheets configuration not found" };
  }

  try {
    console.log("[Sheets] Authenticating with Google Sheets API...");

    // Get authenticated client
    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    // Ensure headers exist
    await ensureHeaders(sheets, config.sheetId);

    // Parse evaluation JSON to get structured data
    let evaluation: VivaEvaluation | null = null;
    try {
      if (row.evaluation) {
        evaluation = JSON.parse(row.evaluation);
      }
    } catch {
      console.warn("[Sheets] Could not parse evaluation JSON");
    }

    // Calculate questions answered
    const questionsAnswered = evaluation?.marks?.length || 0;
    const questionsText = questionsAnswered > 0
      ? `${questionsAnswered} questions`
      : "No questions answered";

    // Prepare row data in cleaner format
    // Note: Google Sheets has a 50,000 character limit per cell, so truncate transcript
    const truncatedTranscript = row.transcript
      ? row.transcript.substring(0, 49000)
      : "-";

    const rowValues = [
      formatTimestamp(row.timestamp),
      row.studentName || "Unknown",
      row.studentEmail || "unknown@example.com",
      row.subject || "Unknown Subject",
      row.topics || "-",
      questionsText,
      formatScoreOutOf100(row.percentage),
      evaluation?.overallFeedback || "No feedback available",
      truncatedTranscript,
      row.recordingUrl || "-",
    ];

    console.log("[Sheets] Appending row to sheet:", {
      sheetId: config.sheetId,
      studentEmail: row.studentEmail,
      subject: row.subject,
      score: rowValues[6],
    });

    // Append the row to the sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: `'${SHEET_NAME}'!A:J`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [rowValues],
      },
    });

    console.log(
      "[Sheets] Successfully saved to Google Sheets:",
      response.data.updates?.updatedRange
    );

    return { success: true };
  } catch (error) {
    console.error("[Sheets] Error saving to Google Sheets:", error);

    // Provide more helpful error messages
    let errorMessage = "Unknown error";
    if (error instanceof Error) {
      errorMessage = error.message;

      // Check for common issues
      if (errorMessage.includes("invalid_grant")) {
        errorMessage =
          "Authentication failed - check GOOGLE_PRIVATE_KEY and GOOGLE_CLIENT_EMAIL";
      } else if (errorMessage.includes("not found")) {
        errorMessage =
          "Spreadsheet not found - check GOOGLE_SHEET_ID and ensure the service account has access";
      } else if (errorMessage.includes("permission")) {
        errorMessage =
          "Permission denied - share the spreadsheet with the service account email";
      }
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Format evaluation data for sheet storage (kept for backward compatibility)
 */
export function formatEvaluationForSheet(
  evaluation: VivaEvaluation
): string {
  return JSON.stringify(evaluation, null, 2);
}
