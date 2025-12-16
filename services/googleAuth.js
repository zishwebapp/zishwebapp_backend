import { google } from "googleapis";
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let sheetsClient = null;
let driveClient = null;
let authClient = null;

/**
 * Authenticate using the service account from file
 */
export async function getAuthClient() {
  if (authClient) return authClient;

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials/service-account.json';
  
  try {
    // Read credentials from file
    const fullPath = join(__dirname, '..', credPath);
    const credentials = JSON.parse(readFileSync(fullPath, 'utf8'));

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ]
    });

    authClient = await auth.getClient();
    return authClient;
  } catch (error) {
    throw new Error(`Failed to load credentials from ${credPath}: ${error.message}`);
  }
}

/**
 * Returns authenticated Google Sheets API client
 */
export async function getSheetsClient() {
  if (sheetsClient) return sheetsClient;

  const auth = await getAuthClient();
  sheetsClient = google.sheets({ version: "v4", auth });

  return sheetsClient;
}

/**
 * Returns authenticated Google Drive API client
 */
export async function getDriveClient() {
  if (driveClient) return driveClient;

  const auth = await getAuthClient();
  driveClient = google.drive({ version: "v3", auth });

  return driveClient;
}