import { getSheetsClient } from "./googleAuth.js";
import { sheetsConfig } from "../config/sheetsConfig.js";
import {
  ensureQuarterlyTabs,
  getQuarterlyTabName,
  getPreviousQuarterlyTabName,
  getSheetIdForTab
} from "./quarterlySheets.js";

// Simple in-memory cache to reduce Google Sheets API calls
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds cache

/**
 * Converts Google Sheets row array → object using column config.
 */
function rowToObject(tableKey, row) {
  const columns = sheetsConfig[tableKey].columns;
  const obj = {};

  columns.forEach((col, index) => {
    obj[col] = row[index] ?? null;
  });

  return obj;
}

/**
 * Converts object → row array in correct column order.
 */
function objectToRow(tableKey, obj) {
  const columns = sheetsConfig[tableKey].columns;
  return columns.map(col => obj[col] ?? "");
}

/**
 * Clear cache for a specific table or all tables
 */
export function clearCache(tableKey) {
  if (tableKey) {
    // Clear specific table cache
    for (const key of cache.keys()) {
      if (key.startsWith(`${tableKey}-`)) {
        cache.delete(key);
      }
    }
  } else {
    // Clear all cache
    cache.clear();
  }
  console.log(`🗑️  Cache cleared for: ${tableKey || 'ALL'}`);
}

/**
 * Get all rows for current quarter (with caching).
 */
export async function getAll(tableKey) {
  // Create cache key with table and time bucket (30s intervals)
  const timeBucket = Math.floor(Date.now() / CACHE_TTL);
  const cacheKey = `${tableKey}-${timeBucket}`;

  // Check cache first
  if (cache.has(cacheKey)) {
    console.log(`✅ Cache HIT: ${tableKey} (saved API call)`);
    return cache.get(cacheKey);
  }

  console.log(`📡 Cache MISS: ${tableKey} (fetching from Google Sheets)`);

  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("MASTER_SPREADSHEET_ID missing in .env");
  }

  await ensureQuarterlyTabs();
  const tabName = getQuarterlyTabName(tableKey);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:Z`
  });

  const rows = res.data.values || [];
  const data = rows.map(r => rowToObject(tableKey, r));

  // Store in cache
  cache.set(cacheKey, data);

  // Auto-cleanup old cache entries (older than 2 minutes)
  const cutoffTime = timeBucket - 4; // 4 buckets ago = 2 minutes
  for (const key of cache.keys()) {
    const keyTimeBucket = parseInt(key.split('-').pop());
    if (keyTimeBucket < cutoffTime) {
      cache.delete(key);
    }
  }

  return data;
}

/**
 * Look for a row with matching ID inside a specific tab.
 * Returns null if the tab doesn't exist yet or the row isn't in it.
 */
async function findInTab(sheets, spreadsheetId, tableKey, id, tabName) {
  const columns = sheetsConfig[tableKey].columns;
  const idIndex = columns.indexOf("id");

  let res;
  try {
    res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A2:Z`
    });
  } catch (err) {
    return null; // tab doesn't exist (e.g. no previous-quarter tab yet)
  }

  const rows = res.data.values || [];

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][idIndex] == id) {
      return {
        data: rowToObject(tableKey, rows[i]),
        rowIndex: i + 2, // because A1 = headers, A2 = first data
        tabName
      };
    }
  }

  return null;
}

/**
 * Get row by ID. Checks the current quarter's tab first; for partitioned
 * tables, falls back to the previous quarter's tab so records created near
 * a quarter boundary stay reachable for updates/deletes after the rollover.
 */
export async function getById(tableKey, id) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

  await ensureQuarterlyTabs();
  const tabName = getQuarterlyTabName(tableKey);

  const found = await findInTab(sheets, spreadsheetId, tableKey, id, tabName);
  if (found) return found;

  const prevTabName = getPreviousQuarterlyTabName(tableKey);
  if (!prevTabName) return null;

  return findInTab(sheets, spreadsheetId, tableKey, id, prevTabName);
}

/**
 * Create (append) a new row in quarterly tab.
 */
export async function create(tableKey, data) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

  await ensureQuarterlyTabs();
  const tabName = getQuarterlyTabName(tableKey);

  const row = objectToRow(tableKey, data);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A:A`,
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [row]
    }
  });

  // Clear cache for this table
  clearCache(tableKey);

  return data;
}

/**
 * Bulk create (append) multiple rows in quarterly tab.
 * More efficient than calling create() multiple times.
 */
export async function bulkCreate(tableKey, dataArray) {
  if (!dataArray || dataArray.length === 0) {
    return [];
  }

  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

  await ensureQuarterlyTabs();
  const tabName = getQuarterlyTabName(tableKey);

  // Convert all data objects to rows
  const rows = dataArray.map(data => objectToRow(tableKey, data));

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A:A`,
    valueInputOption: "USER_ENTERED",
    resource: {
      values: rows
    }
  });

  // Clear cache for this table
  clearCache(tableKey);

  return dataArray;
}

/**
 * Update row with matching ID.
 */
export async function update(tableKey, id, updates) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

  await ensureQuarterlyTabs();

  const found = await getById(tableKey, id);
  if (!found) return null;

  const updated = { ...found.data, ...updates };
  const newRow = objectToRow(tableKey, updated);

  const columns = sheetsConfig[tableKey].columns;
  const lastCol = String.fromCharCode("A".charCodeAt(0) + columns.length - 1);

  // Write back to whichever tab the record was actually found in
  // (current quarter, or the previous quarter's tab).
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${found.tabName}!A${found.rowIndex}:${lastCol}${found.rowIndex}`,
    valueInputOption: "USER_ENTERED",
    resource: {
      values: [newRow]
    }
  });

  // Clear cache for this table
  clearCache(tableKey);

  return updated;
}

/**
 * Delete a row by ID. Looks in the current quarter's tab, falling back to
 * the previous quarter's tab (see getById), so records aren't "lost" right
 * after a quarter rollover.
 */
export async function remove(tableKey, id) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

  await ensureQuarterlyTabs();

  const found = await getById(tableKey, id);
  if (!found) return false;

  const sheetId = await getSheetIdForTab(sheets, spreadsheetId, found.tabName);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: found.rowIndex - 1,
              endIndex: found.rowIndex
            }
          }
        }
      ]
    }
  });

  // Clear cache for this table
  clearCache(tableKey);

  return true;
}

/**
 * Delete multiple rows by ID in one batch. Far cheaper than calling remove()
 * in a loop: one values.get() per tab (instead of one per row) and a single
 * batchUpdate carrying all the deleteDimension requests for that tab.
 * Checks the current quarter's tab and, for partitioned tables, the
 * previous quarter's tab too.
 */
export async function removeMultiple(tableKey, ids) {
  if (!ids || ids.length === 0) return 0;

  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

  await ensureQuarterlyTabs();

  const idSet = new Set(ids.map(String));
  const columns = sheetsConfig[tableKey].columns;
  const idIndex = columns.indexOf("id");

  const tabsToCheck = [getQuarterlyTabName(tableKey)];
  const prevTabName = getPreviousQuarterlyTabName(tableKey);
  if (prevTabName) tabsToCheck.push(prevTabName);

  let deletedCount = 0;

  for (const tabName of tabsToCheck) {
    let res;
    try {
      res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${tabName}!A2:Z`
      });
    } catch (err) {
      continue; // tab doesn't exist
    }

    const rows = res.data.values || [];
    const rowIndexesToDelete = [];

    rows.forEach((row, i) => {
      if (idSet.has(String(row[idIndex]))) {
        rowIndexesToDelete.push(i + 2); // A1 = headers, A2 = first data row
      }
    });

    if (rowIndexesToDelete.length === 0) continue;

    const sheetId = await getSheetIdForTab(sheets, spreadsheetId, tabName);

    // Descending order: deleting from the bottom up means each deletion
    // doesn't shift the row index of the ones still queued up above it.
    rowIndexesToDelete.sort((a, b) => b - a);

    const requests = rowIndexesToDelete.map(rowIndex => ({
      deleteDimension: {
        range: {
          sheetId,
          dimension: "ROWS",
          startIndex: rowIndex - 1,
          endIndex: rowIndex
        }
      }
    }));

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests }
    });

    deletedCount += rowIndexesToDelete.length;
  }

  clearCache(tableKey);

  return deletedCount;
}
