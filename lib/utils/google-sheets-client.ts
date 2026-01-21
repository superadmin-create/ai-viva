/**
 * Replit Google Sheets client using OAuth connector
 */

import { google } from "googleapis";

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken || !hostname) {
    return null;
  }

  try {
    connectionSettings = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken
        }
      }
    ).then(res => res.json()).then(data => data.items?.[0]);

    const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

    if (!connectionSettings || !accessToken) {
      return null;
    }
    return accessToken;
  } catch (error) {
    console.error("[Google Sheets Client] Failed to get access token:", error);
    return null;
  }
}

export async function getGoogleSheetsClient() {
  const accessToken = await getAccessToken();
  
  if (!accessToken) {
    return null;
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

export function extractSheetId(input: string): string {
  if (!input) return input;
  
  if (!input.includes('/') && !input.includes('http')) {
    return input;
  }
  
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  
  return input;
}

export function getSheetId(): string | null {
  const sheetIdInput = process.env.GOOGLE_SHEET_ID;
  if (!sheetIdInput) {
    return null;
  }
  return extractSheetId(sheetIdInput);
}
