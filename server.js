import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import menuRoutes from "./routes/menuRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import authRoutes from "./routes/authRoutes.js";

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

// Load menu data
const menuData = JSON.parse(
  readFileSync(join(__dirname, "data", "menu.json"), "utf-8")
);

console.log("Loaded GOOGLE_PROJECT_CREDENTIALS:", !!process.env.GOOGLE_PROJECT_CREDENTIALS);
console.log(`Menu data loaded: ${menuData.menu?.length || 0} items found`);

// Fix headers in existing quarterly tabs
app.get("/api/fix-sheet-headers", async (req, res) => {
  try {
    console.log("=== Fixing Sheet Headers ===");
    
    const sheets = await (await import("./services/googleAuth.js")).getSheetsClient();
    const spreadsheetId = process.env.MASTER_SPREADSHEET_ID;
    const { sheetsConfig } = await import("./config/sheetsConfig.js");
    const { getQuarterPrefix } = await import("./services/quarterlySheets.js");
    
    const prefix = getQuarterPrefix();
    const updatedTabs = [];
    
    // Fix headers for each table
    for (const [key, config] of Object.entries(sheetsConfig)) {
      const tabName = `${prefix}_${config.sheetName}`;
      
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
        updatedTabs.push(tabName);
      } catch (error) {
        console.log(`⚠️  Skipped ${tabName}: ${error.message}`);
      }
    }
    
    res.json({
      success: true,
      message: "Headers updated successfully",
      updatedTabs,
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
    
    console.log(`Step 2: Preparing to insert ${menuData.menu.length} menu items...`);
    
    // Map all menu items to the correct format matching sheetsConfig columns
    const formattedItems = menuData.menu.map(item => ({
      id: item.id,
      item_name: item.name,
      price: item.price,
      category: item.category_id,
      availability: String(item.is_available).toLowerCase() === 'true' ? 'true' : 'available'
    }));
    
    console.log(`Inserting ${formattedItems.length} items using bulk insert...`);
    
    // Use bulk insert for efficiency
    await bulkCreate("menu_items", formattedItems);
    
    console.log(`Step 2 Complete: Successfully inserted ${formattedItems.length} menu items`);
    
    res.json({
      success: true,
      message: "Quarterly tabs created and menu items inserted successfully",
      quarter: prefix,
      itemsInserted: formattedItems.length,
      totalItems: menuData.menu.length,
      note: "All quarterly tabs have been created with correct column headers"
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


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
