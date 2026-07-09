/**
 * One-time migration: consolidates existing quarter-prefixed tabs for
 * non-partitioned tables (Users, Menu_Items, Inventory_Items) into a single
 * permanent tab each, so login/menu/inventory data survives quarter rollovers.
 *
 * Safe to re-run: it only ever creates/overwrites the permanent tab's data
 * range, it never deletes the old "Q#_YYYY_<Sheet>" tabs — they're left
 * alone as a historical backup.
 *
 * Usage (from zishwebapp_backend/):
 *   node scripts/migrate-permanent-tabs.js
 */
import dotenv from "dotenv";
dotenv.config();

import { getSheetsClient } from "../services/googleAuth.js";
import { sheetsConfig } from "../config/sheetsConfig.js";

const QUARTER_TAB_PATTERN = /^Q([1-4])_(\d{4})_(.+)$/;

function quarterSortKey(quarter, year) {
  return year * 10 + quarter;
}

async function migrateTable(sheets, spreadsheetId, allTabs, tableKey) {
  const cfg = sheetsConfig[tableKey];
  const permanentTabName = cfg.sheetName;
  const columns = cfg.columns;
  const idIndex = columns.indexOf("id");

  // Find every existing quarter-prefixed tab for this table, oldest first.
  const matchingTabs = allTabs
    .map(title => {
      const m = title.match(QUARTER_TAB_PATTERN);
      if (!m || m[3] !== permanentTabName) return null;
      return { title, quarter: Number(m[1]), year: Number(m[2]) };
    })
    .filter(Boolean)
    .sort((a, b) => quarterSortKey(a.quarter, a.year) - quarterSortKey(b.quarter, b.year));

  console.log(`\n[${tableKey}] Found ${matchingTabs.length} legacy quarterly tab(s):`,
    matchingTabs.map(t => t.title).join(", ") || "(none)");

  // Merge rows by id, later (newer-quarter) tabs win on conflicts.
  const merged = new Map();

  for (const tab of matchingTabs) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab.title}!A2:Z`
    });
    const rows = res.data.values || [];
    rows.forEach(row => merged.set(String(row[idIndex]), row));
    console.log(`  - ${tab.title}: ${rows.length} row(s)`);
  }

  // If the permanent tab already exists (e.g. created fresh this quarter
  // before migration ran), layer its rows on top as the most current data.
  const permanentExists = allTabs.includes(permanentTabName);
  if (permanentExists) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${permanentTabName}!A2:Z`
    });
    const rows = res.data.values || [];
    rows.forEach(row => merged.set(String(row[idIndex]), row));
    console.log(`  - ${permanentTabName} (existing permanent tab): ${rows.length} row(s)`);
  } else {
    console.log(`  Creating new permanent tab: ${permanentTabName}`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [{ addSheet: { properties: { title: permanentTabName } } }]
      }
    });
  }

  // Always (re)write the header row.
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${permanentTabName}!A1`,
    valueInputOption: "USER_ENTERED",
    resource: { values: [cfg.headers || cfg.columns] }
  });

  const mergedRows = Array.from(merged.values());

  // Clear any existing data rows first so a shrinking merge doesn't leave
  // stale rows behind, then write the merged set.
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${permanentTabName}!A2:Z`
  });

  if (mergedRows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${permanentTabName}!A2`,
      valueInputOption: "USER_ENTERED",
      resource: { values: mergedRows }
    });
  }

  console.log(`  ✅ ${permanentTabName} now has ${mergedRows.length} row(s) (deduped by id).`);
  console.log(`  Legacy tabs left untouched as backup.`);
}

async function main() {
  const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("MASTER_SPREADSHEET_ID is missing in .env");
  }

  const sheets = await getSheetsClient();
  const metadata = await sheets.spreadsheets.get({ spreadsheetId });
  const allTabs = metadata.data.sheets.map(s => s.properties.title);

  const nonPartitionedTables = Object.keys(sheetsConfig).filter(
    key => sheetsConfig[key].partitioned === false
  );

  console.log("Migrating non-partitioned tables:", nonPartitionedTables.join(", "));

  for (const tableKey of nonPartitionedTables) {
    await migrateTable(sheets, spreadsheetId, allTabs, tableKey);
  }

  console.log("\nMigration complete.");
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
