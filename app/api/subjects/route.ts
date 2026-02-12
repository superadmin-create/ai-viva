import { NextResponse } from "next/server";
import { getGoogleSheetsClient, getSheetId } from "@/lib/utils/google-sheets-client";
import { getTeacherEmailMap } from "@/lib/utils/admin-db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SUBJECTS_SHEET_NAME = "Subjects";

const DEFAULT_SUBJECTS = [
  { name: "Data Structures", teacherEmail: "" },
  { name: "DBMS", teacherEmail: "" },
  { name: "Operating Systems", teacherEmail: "" },
  { name: "Computer Networks", teacherEmail: "" },
];

export async function GET() {
  const sheetId = getSheetId();
  const teacherMap = await getTeacherEmailMap();
  
  if (!sheetId) {
    console.log("[Subjects API] GOOGLE_SHEET_ID not configured, returning defaults");
    const subjects = DEFAULT_SUBJECTS.map(s => ({
      ...s,
      teacherEmail: teacherMap[s.name.toLowerCase()] || s.teacherEmail,
    }));
    return NextResponse.json({ 
      success: true, 
      subjects,
      source: "default"
    });
  }

  try {
    const sheets = await getGoogleSheetsClient();
    
    if (!sheets) {
      console.log("[Subjects API] Google Sheets client not available, returning defaults");
      const subjects = DEFAULT_SUBJECTS.map(s => ({
        ...s,
        teacherEmail: teacherMap[s.name.toLowerCase()] || s.teacherEmail,
      }));
      return NextResponse.json({ 
        success: true, 
        subjects,
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
      .map((row) => ({
        name: row[0],
        teacherEmail: teacherMap[row[0].toLowerCase()] || "",
      }));

    if (subjects.length === 0) {
      const defaultSubjects = DEFAULT_SUBJECTS.map(s => ({
        ...s,
        teacherEmail: teacherMap[s.name.toLowerCase()] || s.teacherEmail,
      }));
      return NextResponse.json({ 
        success: true, 
        subjects: defaultSubjects,
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
    
    const subjects = DEFAULT_SUBJECTS.map(s => ({
      ...s,
      teacherEmail: teacherMap[s.name.toLowerCase()] || s.teacherEmail,
    }));
    return NextResponse.json({ 
      success: true, 
      subjects,
      source: "default"
    });
  }
}
