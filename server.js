import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import menuRoutes from "./routes/menuRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import feedbackRoutes from "./routes/feedbackRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));

// Enable JSON body parsing
app.use(express.json());

import { ensureQuarterlyTabs, getQuarterPrefix } from "./services/quarterlySheets.js";
import { create, bulkCreate } from "./services/sheetService.js";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load menu data (optional - only needed for test-sheets endpoint)
let menuData = { menu: [] };
try {
  menuData = JSON.parse(
    readFileSync(join(__dirname, "data", "menu.json"), "utf-8")
  );
  console.log(`✅ Menu data loaded: ${menuData.menu?.length || 0} items found`);
} catch (error) {
  console.warn("⚠️  menu.json not found - /api/test-sheets endpoint will not work");
  console.warn("This is normal for production deployment where menu data is already in Google Sheets.");
}

console.log("🔑 GOOGLE_PROJECT_CREDENTIALS:", process.env.GOOGLE_PROJECT_CREDENTIALS ? "✅ Set (JSON)" : "❌ Not set");
console.log("📁 GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS ? `✅ Set (${process.env.GOOGLE_APPLICATION_CREDENTIALS})` : "❌ Not set");
console.log("📊 MASTER_SPREADSHEET_ID:", process.env.MASTER_SPREADSHEET_ID ? "✅ Set" : "❌ Not set");
console.log("🌐 FRONTEND_URL:", process.env.FRONTEND_URL || "Not set (defaulting to localhost:3001)");

// Clear cache endpoint (for debugging)
app.get("/api/clear-cache", async (req, res) => {
  try {
    const { clearCache } = await import("./services/sheetService.js");
    clearCache(); // Clear all cache
    res.json({
      success: true,
      message: "Cache cleared successfully"
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Create any missing tabs, then fix headers on every tab (existing or just-created)
app.get("/api/fix-sheet-headers", async (req, res) => {
  try {
    console.log("=== Fixing Sheet Headers ===");

    // Create any missing tabs first, so this endpoint repairs AND creates
    // instead of erroring out on tabs that don't exist yet.
    await ensureQuarterlyTabs();

    const sheets = await (await import("./services/googleAuth.js")).getSheetsClient();
    const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;
    const { sheetsConfig } = await import("./config/sheetsConfig.js");
    const { getQuarterlyTabName } = await import("./services/quarterlySheets.js");

    const updatedTabs = [];
    const errors = [];

    // Fix headers for each table (respects each table's partitioned tab name)
    for (const [key, config] of Object.entries(sheetsConfig)) {
      const tabName = getQuarterlyTabName(key);

      try {
        // Update header row with correct headers
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${tabName}!A1:${String.fromCharCode(64 + config.headers.length)}1`,
          valueInputOption: "USER_ENTERED",
          resource: {
            values: [config.headers]
          }
        });
        
        console.log(`✅ Fixed headers for: ${tabName}`);
        updatedTabs.push({
          tab: tabName,
          table: key,
          headers: config.headers
        });
      } catch (error) {
        console.log(`⚠️  Skipped ${tabName}: ${error.message}`);
        errors.push({
          tab: tabName,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      message: "Headers updated successfully",
      updatedTabs,
      errors,
      note: "All existing quarterly tabs now have correct column headers matching the data structure"
    });
    
  } catch (err) {
    console.error("Error fixing headers:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

// Test route - creates quarterly tabs and adds menu items
app.get("/api/test-sheets", async (req, res) => {
  try {
    console.log("=== Starting test-sheets API ===");
    
    // Ensure tabs exist first
    console.log("Step 1: Ensuring quarterly tabs exist...");
    const prefix = await ensureQuarterlyTabs();
    console.log(`Step 1 Complete: Quarter prefix is ${prefix}`);
    
    console.log(`Step 2: Clearing existing menu_items data before reseeding...`);

    // Clear existing rows first — menu_items uses append-only inserts, so
    // without this, calling this endpoint more than once duplicates every item.
    const { getSheetsClient } = await import("./services/googleAuth.js");
    const { getQuarterlyTabName } = await import("./services/quarterlySheets.js");
    const sheets = await getSheetsClient();
    const menuTabName = getQuarterlyTabName("menu_items");
    await sheets.spreadsheets.values.clear({
      spreadsheetId: process.env.MASTER_SPREADSHEET_ID,
      range: `${menuTabName}!A2:Z`
    });

    console.log(`Step 3: Preparing to insert ${menuData.menu.length} menu items...`);

    // Map all menu items to the correct format matching sheetsConfig columns
    const formattedItems = menuData.menu.map(item => ({
      id: item.id,
      item_name: item.name,
      price: item.price,
      category: item.category_id,
      availability: String(item.is_available).toLowerCase() === 'true' ? 'available' : 'unavailable'
    }));

    console.log(`Inserting ${formattedItems.length} items using bulk insert...`);

    // Use bulk insert for efficiency
    await bulkCreate("menu_items", formattedItems);

    console.log(`Step 3 Complete: Successfully inserted ${formattedItems.length} menu items`);
    
    res.json({
      success: true,
      message: "Tabs created/verified and menu items reseeded successfully",
      quarter: prefix,
      itemsInserted: formattedItems.length,
      totalItems: menuData.menu.length,
      note: "Menu_Items was cleared before reseeding, so this is safe to call again without creating duplicates"
    });
  } catch (err) {
    console.error("=== CRITICAL ERROR in test-sheets API ===");
    console.error("Error name:", err.name);
    console.error("Error message:", err.message);
    console.error("Error stack:", err.stack);
    res.status(500).json({ 
      success: false, 
      error: err.message,
      stack: err.stack 
    });
  }
});




// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/dashboard", dashboardRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
