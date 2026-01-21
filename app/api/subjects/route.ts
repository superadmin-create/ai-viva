import { NextResponse } from "next/server";
import { getGoogleSheetsClient, getSheetId } from "@/lib/utils/google-sheets-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUBJECTS_SHEET_NAME = "Subjects";

const DEFAULT_SUBJECTS = [
  "Data Structures",
  "DBMS",
  "Operating Systems",
  "Computer Networks",
];

export async function GET() {
  const sheetId = getSheetId();
  
  if (!sheetId) {
    console.log("[Subjects API] GOOGLE_SHEET_ID not configured, returning defaults");
    return NextResponse.json({ 
      success: true, 
      subjects: DEFAULT_SUBJECTS,
      source: "default"
    });
  }

  try {
    const sheets = await getGoogleSheetsClient();
    
    if (!sheets) {
      console.log("[Subjects API] Google Sheets client not available, returning defaults");
      return NextResponse.json({ 
        success: true, 
        subjects: DEFAULT_SUBJECTS,
        source: "default"
      });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `'${SUBJECTS_SHEET_NAME}'!A2:C100`,
    });

    const rows = response.data.values || [];
    
    const subjects = rows
      .filter((row) => row[0] && (row[2] === "active" || !row[2]))
      .map((row) => row[0]);

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
    
    return NextResponse.json({ 
      success: true, 
      subjects: DEFAULT_SUBJECTS,
      source: "default"
    });
  }
}
