import { getSheetsClient } from "./googleAuth.js";
import { sheetsConfig } from "../config/sheetsConfig.js";

/**
 * Determine current quarter + year
 * Example: Q1_2025
 */
export function getQuarterPrefix(date = new Date()) {
  const month = date.getMonth(); // 0 = Jan, 11 = Dec
  const year = date.getFullYear();

  let quarter;
  if (month <= 2) quarter = "Q1";      // Jan, Feb, Mar
  else if (month <= 5) quarter = "Q2"; // Apr, May, Jun
  else if (month <= 8) quarter = "Q3"; // Jul, Aug, Sep
  else quarter = "Q4";                 // Oct, Nov, Dec

  return `${quarter}_${year}`;
}

/**
 * Ensure quarterly tabs exist inside MASTER_SPREADSHEET.
 * Creates: Q1_2025_Users, Q1_2025_Orders, etc.
 */
export async function ensureQuarterlyTabs() {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("MASTER_SPREADSHEET_ID is missing in .env");
  }

  // Fetch existing sheets
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const existingTabs = metadata.data.sheets.map(s => s.properties.title);

  const prefix = getQuarterPrefix();

  // Loop each logical table
  for (const key of Object.keys(sheetsConfig)) {
    const cfg = sheetsConfig[key];

    const quarterlyTabName = `${prefix}_${cfg.sheetName}`;

    // If tab already exists, skip
    if (existingTabs.includes(quarterlyTabName)) continue;

    console.log(`Creating new quarterly tab: ${quarterlyTabName}`);

    // 1. Create the sheet tab
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: { properties: { title: quarterlyTabName } }
          }
        ]
      }
    });

    // 2. Add header row
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quarterlyTabName}!A1`,
      valueInputOption: "USER_ENTERED",
      resource: {
        values: [cfg.headers || cfg.columns]
      }
    });
  }

  return prefix; // useful for controllers/services
}

/**
 * Return the correct tab name for specific table in current quarter.
 * Example: "users" → "Q1_2025_Users"
 */
export function getQuarterlyTabName(tableKey) {
  const prefix = getQuarterPrefix();
  const cfg = sheetsConfig[tableKey];
  return `${prefix}_${cfg.sheetName}`;
}
