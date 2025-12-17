import { getSheetsClient } from "./googleAuth.js";
import { sheetsConfig } from "../config/sheetsConfig.js";
import {
  ensureQuarterlyTabs,
  getQuarterlyTabName
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
 * Get row by ID for current quarter.
 */
export async function getById(tableKey, id) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

  await ensureQuarterlyTabs();
  const tabName = getQuarterlyTabName(tableKey);

  const columns = sheetsConfig[tableKey].columns;
  const idIndex = columns.indexOf("id");

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A2:Z`
  });

  const rows = res.data.values || [];

  for (let i = 0; i < rows.length; i++) {
    if (rows[i][idIndex] == id) {
      return {
        data: rowToObject(tableKey, rows[i]),
        rowIndex: i + 2 // because A1 = headers, A2 = first data
      };
    }
  }

  return null;
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
  const tabName = getQuarterlyTabName(tableKey);

  const found = await getById(tableKey, id);
  if (!found) return null;

  const updated = { ...found.data, ...updates };
  const newRow = objectToRow(tableKey, updated);

  const columns = sheetsConfig[tableKey].columns;
  const lastCol = String.fromCharCode("A".charCodeAt(0) + columns.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A${found.rowIndex}:${lastCol}${found.rowIndex}`,
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
 * Delete a row by ID (current quarter only).
 */
export async function remove(tableKey, id) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

  await ensureQuarterlyTabs();
  const tabName = getQuarterlyTabName(tableKey);

  const found = await getById(tableKey, id);
  if (!found) return false;

  const rowIndex = found.rowIndex;

  // Delete row from tab
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: getSheetIdFromName(
                (await sheets.spreadsheets.get({ spreadsheetId })).data.sheets,
                tabName
              ),
              dimension: "ROWS",
              startIndex: rowIndex - 1,
              endIndex: rowIndex
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
 * Helper: Get Google Sheets sheetId by title.
 */
function getSheetIdFromName(sheetsList, title) {
  const sheet = sheetsList.find(s => s.properties.title === title);
  if (!sheet) throw new Error(`Tab '${title}' not found`);
  return sheet.properties.sheetId;
}
