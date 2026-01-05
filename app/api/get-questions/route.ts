import { NextRequest, NextResponse } from "next/server";
import { google, Auth } from "googleapis";

const QUESTIONS_SHEET_NAME = "Viva Questions";

let cachedAuth: Auth.JWT | null = null;

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
  if (cachedAuth) return cachedAuth;

  cachedAuth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  return cachedAuth;
}

interface VivaQuestion {
  id: number;
  question: string;
  expectedAnswer: string;
  difficulty: string;
  topic: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get("subject");

    if (!subject) {
      return NextResponse.json(
        { error: "Subject parameter is required" },
        { status: 400 }
      );
    }

    const config = getSheetsConfig();
    if (!config) {
      console.log("[Get Questions] Google Sheets not configured, using default questions");
      return NextResponse.json({
        success: true,
        subject,
        questions: [],
        message: "No custom questions found, AI will generate questions",
      });
    }

    const auth = getAuthClient(config);
    const sheets = google.sheets({ version: "v4", auth });

    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: `'${QUESTIONS_SHEET_NAME}'!A2:G1000`,
      });
    } catch (sheetError) {
      // Sheet might not exist yet
      console.log("[Get Questions] Viva Questions sheet not found");
      return NextResponse.json({
        success: true,
        subject,
        questions: [],
        message: "No custom questions found, AI will generate questions",
      });
    }

    const rows = response.data.values || [];

    // Filter by subject and active status
    const questions: VivaQuestion[] = rows
      .filter(
        (row) =>
          row[0]?.toLowerCase() === subject.toLowerCase() &&
          row[6]?.toUpperCase() === "TRUE"
      )
      .map((row, index) => ({
        id: index + 1,
        question: row[2] || "",
        expectedAnswer: row[3] || "",
        difficulty: row[4] || "medium",
        topic: row[1] || "",
      }));

    console.log(`[Get Questions] Found ${questions.length} questions for subject: ${subject}`);

    return NextResponse.json({
      success: true,
      subject,
      questions,
      count: questions.length,
    });
  } catch (error) {
    console.error("[Get Questions] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch questions" },
      { status: 500 }
    );
  }
}

