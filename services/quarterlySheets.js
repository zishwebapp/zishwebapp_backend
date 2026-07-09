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

// Simple cache of spreadsheet tab metadata so we don't call spreadsheets.get()
// on every single create/update/remove call. Invalidated whenever we create a tab.
let tabMetadataCache = null;

async function fetchTabMetadata(sheets, spreadsheetId, forceRefresh = false) {
  if (tabMetadataCache && !forceRefresh) return tabMetadataCache;

  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  tabMetadataCache = metadata.data.sheets.map(s => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId
  }));
  return tabMetadataCache;
}

/**
 * Returns the Google Sheets sheetId for a tab by title (cached).
 * Falls back to a fresh fetch if the tab isn't found in the cache
 * (e.g. it was created outside of ensureQuarterlyTabs()).
 */
export async function getSheetIdForTab(sheets, spreadsheetId, tabName) {
  let tabs = await fetchTabMetadata(sheets, spreadsheetId);
  let tab = tabs.find(t => t.title === tabName);

  if (!tab) {
    tabs = await fetchTabMetadata(sheets, spreadsheetId, true);
    tab = tabs.find(t => t.title === tabName);
  }

  if (!tab) throw new Error(`Tab '${tabName}' not found`);
  return tab.sheetId;
}

// ensureQuarterlyTabs() runs on almost every API call. Without a lock,
// concurrent requests (e.g. a page load firing several fetches at once) can
// each see the same tab is missing and both call addSheet — Google Sheets
// then resolves the naming collision by silently renaming the loser to
// "<name>_conflictNNNNN" instead of erroring. Serializing concurrent calls
// through a single in-flight promise makes that race impossible.
let ensureTabsInFlight = null;

/**
 * Ensure required tabs exist inside MASTER_SPREADSHEET.
 * - partitioned tables get a fresh tab per quarter: Q1_2025_Orders, Q2_2025_Orders...
 * - non-partitioned tables (users, menu_items, inventory_items) get ONE permanent tab
 *   that is created once and never re-created on quarter rollover.
 */
export async function ensureQuarterlyTabs() {
  if (ensureTabsInFlight) return ensureTabsInFlight;

  ensureTabsInFlight = (async () => {
    try {
      const sheets = await getSheetsClient();
      const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

      if (!spreadsheetId) {
        throw new Error("MASTER_SPREADSHEET_ID is missing in .env");
      }

      const existingTabs = (await fetchTabMetadata(sheets, spreadsheetId, true)).map(t => t.title);

      const prefix = getQuarterPrefix();

      // Loop each logical table
      for (const key of Object.keys(sheetsConfig)) {
        const cfg = sheetsConfig[key];
        const tabName = getQuarterlyTabName(key);

        // If tab already exists, skip
        if (existingTabs.includes(tabName)) continue;

        console.log(`Creating new tab: ${tabName}`);

        // 1. Create the sheet tab
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                addSheet: { properties: { title: tabName } }
              }
            ]
          }
        });

        // 2. Add header row
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${tabName}!A1`,
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [cfg.headers || cfg.columns]
          }
        });
      }

      // Refresh cache so newly created tabs are visible to getSheetIdForTab()
      await fetchTabMetadata(sheets, spreadsheetId, true);

      return prefix; // useful for controllers/services
    } finally {
      ensureTabsInFlight = null;
    }
  })();

  return ensureTabsInFlight;
}

/**
 * Return the correct tab name for a table in the current quarter.
 * Partitioned tables:     "users" → "Q1_2025_Orders" (quarter-prefixed)
 * Non-partitioned tables: "users" → "Users" (fixed, permanent)
 */
export function getQuarterlyTabName(tableKey) {
  const cfg = sheetsConfig[tableKey];

  if (cfg.partitioned === false) {
    return cfg.sheetName;
  }

  const prefix = getQuarterPrefix();
  return `${prefix}_${cfg.sheetName}`;
}

/**
 * Return the previous quarter's tab name for a partitioned table, or null
 * for non-partitioned tables (there's no "previous" — it's one permanent tab).
 * Used as a fallback lookup so records created near a quarter boundary
 * remain reachable for updates/deletes shortly after the rollover.
 */
export function getPreviousQuarterlyTabName(tableKey) {
  const cfg = sheetsConfig[tableKey];
  if (cfg.partitioned === false) return null;

  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  const quarters = ["Q1", "Q2", "Q3", "Q4"];
  const currentIndex = month <= 2 ? 0 : month <= 5 ? 1 : month <= 8 ? 2 : 3;

  let prevIndex = currentIndex - 1;
  let prevYear = year;
  if (prevIndex < 0) {
    prevIndex = 3;
    prevYear -= 1;
  }

  return `${quarters[prevIndex]}_${prevYear}_${cfg.sheetName}`;
}
