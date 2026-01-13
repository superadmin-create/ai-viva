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
 * Clear cached auth client (useful when authentication fails)
 */
function clearAuthCache() {
  cachedAuth = null;
  console.log("[Sheets] Cleared authentication cache");
}

/**
 * Extract Google Sheet ID from URL or return as-is if already an ID
 * Supports formats:
 * - https://docs.google.com/spreadsheets/d/SHEET_ID/edit
 * - https://docs.google.com/spreadsheets/d/SHEET_ID/edit#gid=0
 * - SHEET_ID (direct ID)
 */
function extractSheetId(input: string): string {
  if (!input) return input;
  
  // If it's already just an ID (no slashes or special chars), return as-is
  if (!input.includes('/') && !input.includes('http')) {
    return input;
  }
  
  // Extract from URL pattern: /spreadsheets/d/SHEET_ID/
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  // If no match, return as-is (might be malformed, but let Google API handle it)
  return input;
}

/**
 * Get Google Sheets configuration from environment variables
 */
function getSheetsConfig(): GoogleSheetsConfig | null {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  // Support both naming conventions
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const sheetIdInput = process.env.GOOGLE_SHEET_ID;

  if (!privateKey || !clientEmail || !sheetIdInput) {
    console.warn(
      "[Sheets] Google Sheets configuration not found. Required: GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL (or GOOGLE_SERVICE_ACCOUNT_EMAIL), GOOGLE_SHEET_ID"
    );
    return null;
  }

  // Extract sheet ID from URL if provided, or use as-is
  const sheetId = extractSheetId(sheetIdInput);

  // Unescape newlines in private key (common issue with env vars)
  const unescapedKey = privateKey.replace(/\\n/g, "\n");

  console.log("[Sheets] Using Google Sheet ID:", sheetId);

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
    // First, get spreadsheet to check if sheet tab exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    const sheetExists = spreadsheet.data.sheets?.some(
      (sheet) => sheet.properties?.title === SHEET_NAME
    );

    // If sheet doesn't exist, create it
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

    // Check if first row has headers
    let firstRow: any[] | undefined;
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${SHEET_NAME}'!A1:K1`,
      });
      firstRow = response.data.values?.[0];
    } catch (e: any) {
      // If range doesn't exist yet (empty sheet), firstRow will be undefined
      console.log(`[Sheets] Sheet is empty or headers don't exist yet`);
    }

    // If no headers exist, create them
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
    // Log the error but don't throw - we'll try to append anyway
    console.error("[Sheets] Error in ensureHeaders:", error);
    if (error instanceof Error) {
      console.error("[Sheets] Error message:", error.message);
    }
    // Don't throw - let the append operation handle the error
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
    console.error("[Sheets] Configuration missing - check environment variables");
    return { success: false, error: "Sheets configuration not found. Check GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL, and GOOGLE_SHEET_ID" };
  }

  try {
    console.log("[Sheets] ===== Starting save to Google Sheets =====");
    console.log("[Sheets] Sheet ID:", config.sheetId);
    console.log("[Sheets] Service Account:", config.clientEmail);
    console.log("[Sheets] Authenticating with Google Sheets API...");

    // Get authenticated client - clear cache to force re-auth if needed
    const auth = getAuthClient(config);
    
    // Ensure we have valid credentials
    try {
      await auth.authorize();
      console.log("[Sheets] ✓ Authentication successful");
    } catch (authError) {
      console.error("[Sheets] ✗ Authentication failed:", authError);
      // Clear cache to force re-authentication next time
      clearAuthCache();
      const errorMsg = authError instanceof Error ? authError.message : String(authError);
      throw new Error(`Authentication failed: ${errorMsg}. Check GOOGLE_PRIVATE_KEY and GOOGLE_CLIENT_EMAIL.`);
    }

    const sheets = google.sheets({ version: "v4", auth });

    // Verify spreadsheet exists and is accessible
    try {
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: config.sheetId,
      });
      console.log("[Sheets] ✓ Spreadsheet found:", spreadsheet.data.properties?.title || "Untitled");
    } catch (spreadsheetError: any) {
      console.error("[Sheets] ✗ Cannot access spreadsheet:", spreadsheetError.message);
      if (spreadsheetError.message?.includes("not found")) {
        throw new Error(`Spreadsheet not found. Check GOOGLE_SHEET_ID: ${config.sheetId}`);
      } else if (spreadsheetError.message?.includes("permission") || spreadsheetError.message?.includes("PERMISSION_DENIED")) {
        throw new Error(`Permission denied. Share the spreadsheet with service account: ${config.clientEmail}`);
      }
      throw spreadsheetError;
    }

    // Ensure headers exist
    console.log("[Sheets] Ensuring headers exist in sheet:", SHEET_NAME);
    await ensureHeaders(sheets, config.sheetId);
    console.log("[Sheets] ✓ Headers verified/created");

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

    // Format evaluation JSON for storage
    // Ensure evaluation is properly stringified if it's an object
    let evaluationJson = "";
    if (row.evaluation) {
      // If it's already a string, use it; otherwise stringify
      evaluationJson = typeof row.evaluation === 'string' 
        ? row.evaluation 
        : JSON.stringify(row.evaluation);
    } else if (evaluation) {
      evaluationJson = JSON.stringify(evaluation);
    }

    const rowValues = [
      formatTimestamp(row.timestamp),
      row.studentName || "Unknown",
      row.studentEmail || "unknown@example.com",
      row.subject || "Unknown Subject",
      row.topics || "-",
      questionsText, // Column F: Questions Answered
      formatScoreOutOf100(row.percentage), // Column G: Score
      evaluation?.overallFeedback || "No feedback available", // Column H: Overall Feedback
      truncatedTranscript, // Column I: Transcript
      row.recordingUrl || "-", // Column J: Recording
      evaluationJson, // Column K: Evaluation JSON
    ];

    // Verify row has correct number of columns (should be 11: A through K)
    if (rowValues.length !== 11) {
      console.error(`[Sheets] ERROR: Row has ${rowValues.length} columns, expected 11. This may cause data misalignment.`);
    }

    console.log("[Sheets] Preparing to append row:", {
      sheetId: config.sheetId,
      sheetName: SHEET_NAME,
      studentEmail: row.studentEmail,
      studentName: row.studentName,
      subject: row.subject,
      score: rowValues[6],
      hasEvaluation: !!evaluationJson,
      evaluationLength: evaluationJson?.length || 0,
      rowColumns: rowValues.length,
    });

    // Validate row data before saving
    if (!row.studentEmail || row.studentEmail === "unknown@example.com") {
      console.warn("[Sheets] Warning: Student email is missing or default");
    }
    if (!row.subject || row.subject === "Unknown Subject") {
      console.warn("[Sheets] Warning: Subject is missing or default");
    }

    // Append the row to the sheet
    console.log("[Sheets] Calling Google Sheets API append...");
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: config.sheetId,
      range: `'${SHEET_NAME}'!A:K`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [rowValues],
      },
    });

    // Verify the response
    if (response.data.updates) {
      console.log("[Sheets] ✓ Successfully saved to Google Sheets!");
      console.log("[Sheets] Updated range:", response.data.updates.updatedRange);
      console.log("[Sheets] Updated rows:", response.data.updates.updatedRows);
      console.log("[Sheets] Updated cells:", response.data.updates.updatedCells);
      return { success: true };
    } else {
      console.warn("[Sheets] ⚠ Append completed but no update info in response");
      // Still return success if no error was thrown
      return { success: true };
    }
  } catch (error) {
    console.error("[Sheets] ===== ERROR SAVING TO GOOGLE SHEETS =====");
    console.error("[Sheets] Error type:", error?.constructor?.name || typeof error);
    console.error("[Sheets] Error details:", error);

    // Provide more helpful error messages
    let errorMessage = "Unknown error";
    let detailedError = "";
    
    if (error instanceof Error) {
      errorMessage = error.message;
      detailedError = error.stack || error.message;

      // Check for common issues and provide specific guidance
      if (errorMessage.includes("invalid_grant") || errorMessage.includes("INVALID_GRANT")) {
        errorMessage = "Authentication failed - Invalid credentials";
        detailedError = "Check GOOGLE_PRIVATE_KEY and GOOGLE_CLIENT_EMAIL. The private key may be expired or incorrectly formatted.";
        // Clear auth cache on auth failure
        clearAuthCache();
      } else if (errorMessage.includes("not found") || errorMessage.includes("NOT_FOUND")) {
        errorMessage = "Spreadsheet not found";
        detailedError = `Check GOOGLE_SHEET_ID: ${config?.sheetId || "not set"}. Ensure the service account has access to the spreadsheet.`;
      } else if (errorMessage.includes("permission") || errorMessage.includes("PERMISSION_DENIED")) {
        errorMessage = "Permission denied";
        detailedError = `Share the spreadsheet with the service account email: ${config?.clientEmail || "not set"}. Grant Editor access.`;
      } else if (errorMessage.includes("invalid value") || errorMessage.includes("INVALID_ARGUMENT")) {
        errorMessage = "Invalid data format";
        detailedError = "Check that all row values are properly formatted. Review the rowValues array in logs.";
      } else if (errorMessage.includes("quota") || errorMessage.includes("QUOTA_EXCEEDED")) {
        errorMessage = "API quota exceeded";
        detailedError = "Google Sheets API quota has been exceeded. Wait a few minutes and try again.";
      }
    } else if (typeof error === "string") {
      errorMessage = error;
      detailedError = error;
    } else {
      detailedError = JSON.stringify(error, null, 2);
    }

    console.error("[Sheets] Error message:", errorMessage);
    console.error("[Sheets] Detailed error:", detailedError);
    console.error("[Sheets] ===== END ERROR =====");

    return {
      success: false,
      error: `${errorMessage}. ${detailedError}`,
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
