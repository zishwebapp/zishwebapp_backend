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
 * Authenticate using the service account from environment variable or file
 * Priority: GOOGLE_PROJECT_CREDENTIALS (JSON string) > GOOGLE_APPLICATION_CREDENTIALS (file path)
 */
export async function getAuthClient() {
  if (authClient) return authClient;

  try {
    let credentials;

    // Option 1: Try to get credentials from environment variable (for Render/production)
    if (process.env.GOOGLE_PROJECT_CREDENTIALS) {
      console.log('📝 Loading Google credentials from GOOGLE_PROJECT_CREDENTIALS env variable');
      
      try {
        credentials = JSON.parse(process.env.GOOGLE_PROJECT_CREDENTIALS);
        console.log('✅ Successfully parsed credentials from environment variable');
      } catch (parseError) {
        throw new Error(`Failed to parse GOOGLE_PROJECT_CREDENTIALS: ${parseError.message}`);
      }
    } 
    // Option 2: Fall back to reading from file (for local development)
    else {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './credentials/service-account.json';
      console.log(`📁 Loading Google credentials from file: ${credPath}`);
      
      const fullPath = join(__dirname, '..', credPath);
      credentials = JSON.parse(readFileSync(fullPath, 'utf8'));
      console.log('✅ Successfully loaded credentials from file');
    }

    // Create auth client with credentials
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ]
    });

    authClient = await auth.getClient();
    console.log('✅ Google Auth client created successfully');
    return authClient;
    
  } catch (error) {
    console.error('❌ Failed to authenticate with Google:', error.message);
    throw new Error(`Google authentication failed: ${error.message}`);
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