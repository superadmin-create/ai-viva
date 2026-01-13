/**
 * Utility script to extract Google Sheet ID from a URL
 * Usage: node scripts/extract-sheet-id.js "https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit"
 */

function extractSheetId(url) {
  if (!url) {
    console.error("Please provide a Google Sheets URL");
    console.log("\nUsage: node scripts/extract-sheet-id.js \"YOUR_GOOGLE_SHEETS_URL\"");
    process.exit(1);
  }

  // Pattern: https://docs.google.com/spreadsheets/d/SHEET_ID/edit
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  
  if (match && match[1]) {
    const sheetId = match[1];
    console.log("\n✓ Google Sheet ID extracted:");
    console.log(sheetId);
    console.log("\nAdd this to your .env file:");
    console.log(`GOOGLE_SHEET_ID=${sheetId}`);
    return sheetId;
  } else {
    console.error("✗ Could not extract Sheet ID from URL");
    console.log("\nExpected format:");
    console.log("https://docs.google.com/spreadsheets/d/SHEET_ID/edit");
    console.log("\nYour URL:", url);
    process.exit(1);
  }
}

// Get URL from command line arguments
const url = process.argv[2];
extractSheetId(url);
