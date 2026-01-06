import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// Force dynamic rendering - always fetch fresh data
export const dynamic = "force-dynamic";
export const revalidate = 0;

const TOPICS_SHEET_NAME = "Topics";

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

// GET - Fetch topics for a subject (teacher-defined)
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
        range: `'${TOPICS_SHEET_NAME}'!A2:C100`,
      });
    } catch (sheetError) {
      console.log("[Topics API] Topics sheet not found");
      return NextResponse.json({
        success: true,
        subject,
        topics: [],
        message: "No topics found",
      });
    }

    const rows = response.data.values || [];

    // Filter by subject and active status
    // Column format: Subject, Topic Name, Status
    const topics = rows
      .filter(
        (row) =>
          row[0]?.toLowerCase() === subject.toLowerCase() &&
          row[1] && // Has topic name
          (row[2] === "active" || !row[2]) // Active or no status
      )
      .map((row) => row[1]); // Return just the topic names

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
