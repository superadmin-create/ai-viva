# How to Update Google Sheet ID

## Quick Setup

### Option 1: Using Sheet ID Directly

1. Open your Google Sheet
2. Copy the Sheet ID from the URL (the part between `/d/` and `/edit`)
3. Add to `.env` file:

```env
GOOGLE_SHEET_ID=your-sheet-id-here
```

### Option 2: Using Full URL

You can also paste the full Google Sheets URL - the code will automatically extract the ID:

```env
GOOGLE_SHEET_ID=https://docs.google.com/spreadsheets/d/your-sheet-id/edit
```

## Example

If your Google Sheet URL is:
```
https://docs.google.com/spreadsheets/d/1ABC123xyz789DEF456/edit#gid=0
```

You can set either:
```env
GOOGLE_SHEET_ID=1ABC123xyz789DEF456
```

OR:
```env
GOOGLE_SHEET_ID=https://docs.google.com/spreadsheets/d/1ABC123xyz789DEF456/edit
```

Both will work!

## Important: Share the Sheet

After setting the Sheet ID, make sure to:

1. Open your Google Sheet
2. Click "Share" button
3. Add your service account email (from `GOOGLE_CLIENT_EMAIL`)
4. Give it **Editor** access
5. Click "Send"

## Verify Setup

After updating, restart your server and check logs:
- Look for: `[Sheets] Using Google Sheet ID: your-id`
- Test by running a viva and checking if results appear in the sheet
