import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Force dynamic rendering - always fetch fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

const QUESTIONS_SHEET_NAME = "Viva Questions";

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

// GET - Fetch unique topics for a subject
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
      console.log("[Topics API] Google Sheets not configured");
      return NextResponse.json({
        success: true,
        subject,
        topics: [],
        message: "No topics found",
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
      console.log("[Topics API] Viva Questions sheet not found");
      return NextResponse.json({
        success: true,
        subject,
        topics: [],
        message: "No topics found",
      });
    }

    const rows = response.data.values || [];

    // Get unique topics for the subject (column A = subject, column B = topics, column G = active)
    const topicsSet = new Set<string>();
    
    rows
      .filter(
        (row) =>
          row[0]?.toLowerCase() === subject.toLowerCase() &&
          row[6]?.toUpperCase() === "TRUE" &&
          row[1] // Has topics
      )
      .forEach((row) => {
        // Topics might be comma-separated, split them
        const topicsStr = row[1] || "";
        topicsStr.split(",").forEach((topic: string) => {
          const trimmed = topic.trim();
          if (trimmed) {
            topicsSet.add(trimmed);
          }
        });
      });

    const topics = Array.from(topicsSet).sort();

    console.log(`[Topics API] Found ${topics.length} topics for subject: ${subject}`);

    return NextResponse.json({
      success: true,
      subject,
      topics,
      count: topics.length,
    });
  } catch (error) {
    console.error("[Topics API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch topics" },
      { status: 500 }
    );
  }
}

