# Google Sheets Setup Guide

## How to Get Your Google Sheet ID

### From Google Sheets URL

If you have a Google Sheets link like:
```
https://docs.google.com/spreadsheets/d/1ABC123xyz789/edit#gid=0
```

The Sheet ID is the part between `/d/` and `/edit`:
```
1ABC123xyz789
```

### Steps to Configure

1. **Open your Google Sheet**
2. **Copy the Sheet ID** from the URL
3. **Add to `.env` file** in `ai-viva-main` directory:

```env
GOOGLE_SHEET_ID=your-sheet-id-here
```

4. **Share the sheet** with your service account email:
   - Open Google Sheet
   - Click "Share" button
   - Add the service account email (from `GOOGLE_CLIENT_EMAIL`)
   - Give it **Editor** access (not just Viewer)

5. **Restart the server** for changes to take effect

## Required Sheets

Your Google Sheet should have these tabs:

1. **"Viva Results"** - Where viva results are saved
   - Will be created automatically if it doesn't exist
   - Headers will be created automatically

2. **"Viva Questions"** - Where questions are stored (optional)
   - Used by Admin Panel to save generated questions
   - Used by AI Viva to fetch questions during viva

## Quick Setup Script

If you have the full Google Sheets URL, you can extract the ID:

```bash
# Example URL
URL="https://docs.google.com/spreadsheets/d/1ABC123xyz789/edit#gid=0"

# Extract ID (manual)
# The ID is: 1ABC123xyz789
```

## Verification

After setting up, test by:
1. Running a viva
2. Check server logs for: `[Sheets] ✓ Successfully saved to Google Sheets!`
3. Check your Google Sheet - new row should appear in "Viva Results" tab
