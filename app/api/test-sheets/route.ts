import { NextResponse } from "next/server";
import { getGoogleSheetsClient, getSheetId } from "@/lib/utils/google-sheets-client";

const SHEET_NAME = "Viva Results";

export async function GET() {
  try {
    const sheetId = getSheetId();
    if (!sheetId) {
      return NextResponse.json({
        success: false,
        error: "GOOGLE_SHEET_ID not configured",
      }, { status: 400 });
    }

    const sheets = await getGoogleSheetsClient();
    if (!sheets) {
      return NextResponse.json({
        success: false,
        error: "Google Sheets connection not available. Please set up the Google Sheets integration.",
      }, { status: 400 });
    }

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: sheetId,
    });

    const sheetExists = spreadsheet.data.sheets?.some(
      (sheet) => sheet.properties?.title === SHEET_NAME
    );

    let headers: string[] = [];
    try {
      const headersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `'${SHEET_NAME}'!A1:K1`,
      });
      headers = headersResponse.data.values?.[0] || [];
    } catch (e) {
    }

    let appendSuccess = false;
    let appendError = "";
    try {
      const testRow = [
        new Date().toISOString(),
        "Test Student",
        "test@example.com",
        "Test Subject",
        "Test Topics",
        "0 questions",
        "0/100",
        "Test feedback",
        "Test transcript",
        "-",
        "{}",
      ];

      const appendResponse = await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `'${SHEET_NAME}'!A:K`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [testRow],
        },
      });

      appendSuccess = !!appendResponse.data.updates;
    } catch (e: any) {
      appendError = e.message || String(e);
    }

    return NextResponse.json({
      success: true,
      config: {
        sheetId: sheetId,
      },
      spreadsheet: {
        title: spreadsheet.data.properties?.title || "Untitled",
        exists: true,
      },
      sheet: {
        name: SHEET_NAME,
        exists: sheetExists,
        headers: headers,
        headerCount: headers.length,
      },
      testAppend: {
        success: appendSuccess,
        error: appendError || undefined,
      },
      message: appendSuccess 
        ? "✓ All tests passed! Sheets integration is working."
        : `⚠ Append test failed: ${appendError}`,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || String(error),
      message: "Failed to test Google Sheets connection",
    }, { status: 500 });
  }
}
