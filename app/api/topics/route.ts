import { NextRequest, NextResponse } from "next/server";
import { getGoogleSheetsClient, getSheetId } from "@/lib/utils/google-sheets-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TOPICS_SHEET_NAME = "Topics";

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

    const sheetId = getSheetId();
    if (!sheetId) {
      console.log("[Topics API] GOOGLE_SHEET_ID not configured");
      return NextResponse.json({
        success: true,
        subject,
        topics: [],
        message: "No topics found",
      });
    }

    const sheets = await getGoogleSheetsClient();
    if (!sheets) {
      console.log("[Topics API] Google Sheets client not available");
      return NextResponse.json({
        success: true,
        subject,
        topics: [],
        message: "No topics found",
      });
    }

    let response;
    try {
      response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
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

    const topics = rows
      .filter(
        (row) =>
          row[0]?.toLowerCase() === subject.toLowerCase() &&
          row[1] &&
          (row[2] === "active" || !row[2])
      )
      .map((row) => row[1]);

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
