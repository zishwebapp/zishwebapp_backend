import { getSheetsClient } from "../services/googleAuth.js";

export async function getMenuItems(req, res) {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;

    // STEP 1 — Get metadata for all sheet tabs
    const meta = await sheets.spreadsheets.get({ spreadsheetId });
    const tabs = meta.data.sheets.map(s => s.properties.title);

    // STEP 2 — Find tab containing "menu_items" (case insensitive)
    const tabName = tabs.find(t =>
      t.toLowerCase().includes("menu_items")
    );

    if (!tabName) {
      return res.status(404).json({
        success: false,
        message: "No sheet found containing 'menu_items'"
      });
    }

    console.log("Using menu sheet:", tabName);

    // STEP 3 — Fetch menu rows
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tabName}!A2:Z`
    });

    const rows = response.data.values || [];

    // STEP 4 — Map rows into objects
    // Google Sheets columns: ["id", "item_name", "price", "category", "availability"]
    const menu = rows.map(row => ({
      id: row[0] ?? null,
      name: row[1] ?? "",
      price: row[2] ? Number(row[2]) : null,
      category_id: row[3] ? Number(row[3]) : null,
      description: "", // Not stored in Google Sheets
      image_url: "", // Not stored in Google Sheets
      is_available: (row[4] || "").toLowerCase() === "true" || (row[4] || "").toLowerCase() === "available",
      preparation_time_minutes: null, // Not stored in Google Sheets
      created_at: null,
      updated_at: null
    }));

    res.json({
      success: true,
      sheet_used: tabName,
      count: menu.length,
      menu
    });

  } catch (error) {
    console.error("MENU FETCH ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error loading menu items",
      error: error.message
    });
  }
}
