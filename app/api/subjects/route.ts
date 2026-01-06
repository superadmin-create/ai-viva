import { NextResponse } from "next/server";
import { google } from "googleapis";

// Force dynamic rendering - always fetch fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUBJECTS_SHEET_NAME = "Subjects";

function getSheetsConfig() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail =
    process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!privateKey || !clientEmail || !sheetId) {
    return null;
  }

  return {
    privateKey: privateKey.replace(/\\n/g, "\n"),
    clientEmail,
    sheetId,
  };
}

function getAuthClient(config: { privateKey: string; clientEmail: string }) {
  return new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

// Default subjects as fallback
const DEFAULT_SUBJECTS = [
  "Data Structures",
  "DBMS",
  "Operating Systems",
  "Computer Networks",
];

// GET - Fetch all subjects from Google Sheets
export async function GET() {
  const config = getSheetsConfig();
  
  // If Google Sheets is not configured, return default subjects
  if (!config) {
    console.log("[Subjects API] Google Sheets not configured, returning defaults");
    return NextResponse.json({ 
      success: true, 
      subjects: DEFAULT_SUBJECTS,
      source: "default"
    });
  }

  try {
    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    // Try to get subjects from the Subjects sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.sheetId,
      range: `'${SUBJECTS_SHEET_NAME}'!A2:C100`,
    });

    const rows = response.data.values || [];
    
    // Only get active subjects (column C = status)
    const subjects = rows
      .filter((row) => row[0] && (row[2] === "active" || !row[2]))
      .map((row) => row[0]);

    // If no subjects in sheet, return defaults
    if (subjects.length === 0) {
      return NextResponse.json({ 
        success: true, 
        subjects: DEFAULT_SUBJECTS,
        source: "default"
      });
    }

    return NextResponse.json({ 
      success: true, 
      subjects,
      source: "sheets"
    });
  } catch (error: unknown) {
    console.error("[Subjects API] Error fetching subjects:", error);
    
    // If sheet doesn't exist or any error, return defaults
    return NextResponse.json({ 
      success: true, 
      subjects: DEFAULT_SUBJECTS,
      source: "default"
    });
  }
}

