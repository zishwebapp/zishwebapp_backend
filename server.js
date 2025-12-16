import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import menuRoutes from "./routes/menuRoutes.js";

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const app = express();

// Enable CORS for frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));

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

// Test route - creates quarterly tabs and adds menu items
app.get("/api/test-sheets", async (req, res) => {
  try {
    console.log("=== Starting test-sheets API ===");
    
    // Ensure tabs exist first
    console.log("Step 1: Ensuring quarterly tabs exist...");
    const prefix = await ensureQuarterlyTabs();
    console.log(`Step 1 Complete: Quarter prefix is ${prefix}`);
    
    console.log(`Step 2: Preparing to insert ${menuData.menu.length} menu items...`);
    
    // Map all menu items to the correct format
    const formattedItems = menuData.menu.map(item => ({
      id: item.id,
      item_name: item.name,              // mapping: name → item_name
      price: item.price,
      category: item.category_id,        // mapping: category_id → category
      availability: item.is_available    // mapping: is_available → availability
    }));
    
    console.log(`Inserting ${formattedItems.length} items using bulk insert...`);
    
    // Use bulk insert for efficiency
    await bulkCreate("menu_items", formattedItems);
    
    console.log(`Step 2 Complete: Successfully inserted ${formattedItems.length} menu items`);
    
    res.json({
      success: true,
      message: "Menu items processing complete",
      quarter: prefix,
      itemsInserted: formattedItems.length,
      totalItems: menuData.menu.length
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




app.use("/api/menu", menuRoutes);


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
