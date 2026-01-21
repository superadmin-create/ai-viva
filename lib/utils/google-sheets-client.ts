/**
 * Google Sheets client using Service Account authentication
 */

import { google, Auth } from "googleapis";

let cachedAuth: Auth.JWT | null = null;

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

interface ServiceAccountConfig {
  privateKey: string;
  clientEmail: string;
}

function getServiceAccountConfig(): ServiceAccountConfig | null {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKey || !clientEmail) {
    return null;
  }

  return {
    privateKey: privateKey.replace(/\\n/g, "\n"),
    clientEmail,
  };
}

export async function getGoogleSheetsClient() {
  const config = getServiceAccountConfig();
  
  if (!config) {
    console.warn("[Google Sheets] Service account not configured. Need GOOGLE_PRIVATE_KEY and GOOGLE_CLIENT_EMAIL");
    return null;
  }

  if (!cachedAuth) {
    cachedAuth = new google.auth.JWT({
      email: config.clientEmail,
      key: config.privateKey,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }

  try {
    await cachedAuth.authorize();
  } catch (error) {
    console.error("[Google Sheets] Authentication failed:", error);
    cachedAuth = null;
    return null;
  }

  return google.sheets({ version: 'v4', auth: cachedAuth });
}

export function getServiceAccountEmail(): string | null {
  return process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null;
}
