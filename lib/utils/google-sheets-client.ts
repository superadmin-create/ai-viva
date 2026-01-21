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

function formatPrivateKey(key: string): string {
  // Handle different formats of the private key
  let formattedKey = key;
  
  // Replace literal \n with actual newlines
  formattedKey = formattedKey.replace(/\\n/g, '\n');
  
  // If the key doesn't start with the header, it might be base64 or need formatting
  if (!formattedKey.includes('-----BEGIN')) {
    // Try to add headers if missing
    formattedKey = `-----BEGIN PRIVATE KEY-----\n${formattedKey}\n-----END PRIVATE KEY-----\n`;
  }
  
  // Ensure proper newlines around headers
  formattedKey = formattedKey
    .replace(/-----BEGIN PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----\n')
    .replace(/-----END PRIVATE KEY-----/, '\n-----END PRIVATE KEY-----')
    .replace(/\n\n+/g, '\n');
  
  return formattedKey;
}

function getServiceAccountConfig(): ServiceAccountConfig | null {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  if (!privateKey || !clientEmail) {
    console.warn("[Google Sheets] Missing credentials. Required: GOOGLE_PRIVATE_KEY, GOOGLE_CLIENT_EMAIL");
    return null;
  }

  const formattedKey = formatPrivateKey(privateKey);

  return {
    privateKey: formattedKey,
    clientEmail,
  };
}

export async function getGoogleSheetsClient() {
  const config = getServiceAccountConfig();
  
  if (!config) {
    return null;
  }

  // Always create a fresh auth client to avoid stale credentials
  cachedAuth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  try {
    await cachedAuth.authorize();
    console.log("[Google Sheets] Successfully authenticated as:", config.clientEmail);
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
