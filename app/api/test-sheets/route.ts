import { NextResponse } from "next/server";
import { google, Auth } from "googleapis";

const SHEET_NAME = "Viva Results";

function getSheetsConfig() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const sheetIdInput = process.env.GOOGLE_SHEET_ID;

  if (!privateKey || !clientEmail || !sheetIdInput) {
    return null;
  }

  // Extract sheet ID from URL if provided
  const sheetId = sheetIdInput.includes('/') 
    ? sheetIdInput.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1] || sheetIdInput
    : sheetIdInput;

  return {
    privateKey: privateKey.replace(/\\n/g, "\n"),
    clientEmail,
    sheetId,
  };
}

export async function GET() {
  try {
    const config = getSheetsConfig();
    if (!config) {
      return NextResponse.json({
        success: false,
        error: "Configuration missing. Check GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL, GOOGLE_SHEET_ID",
      }, { status: 400 });
    }

    const auth = new google.auth.JWT({
      email: config.clientEmail,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    await auth.authorize();
    const sheets = google.sheets({ version: "v4", auth });

    // Test 1: Check if spreadsheet exists
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: config.sheetId,
    });

    // Test 2: Check if sheet tab exists
    const sheetExists = spreadsheet.data.sheets?.some(
      (sheet) => sheet.properties?.title === SHEET_NAME
    );

    // Test 3: Try to read headers
    let headers: string[] = [];
    try {
      const headersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: config.sheetId,
        range: `'${SHEET_NAME}'!A1:K1`,
      });
      headers = headersResponse.data.values?.[0] || [];
    } catch (e) {
      // Sheet might be empty
    }

    // Test 4: Try to append a test row
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
        spreadsheetId: config.sheetId,
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
        sheetId: config.sheetId,
        clientEmail: config.clientEmail,
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
