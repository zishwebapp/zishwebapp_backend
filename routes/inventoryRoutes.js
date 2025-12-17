import express from "express";
import { 
  getInventoryItems,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  placeInventoryOrder,
  listInventoryOrders,
  markOrderPurchased,
  getInventoryInsights,
  exportInventoryInsights
} from "../controllers/inventoryController.js";

const router = express.Router();

// Inventory Items routes
router.get("/items", getInventoryItems);                            // Get all inventory items (with status filter)
router.post("/items", createInventoryItem);                         // Create new inventory item
router.put("/items/:id", updateInventoryItem);                      // Update inventory item
router.delete("/items/:id", deleteInventoryItem);                   // Delete inventory item

// Inventory Orders routes
router.post("/orders", placeInventoryOrder);                        // Place inventory order
router.get("/orders", listInventoryOrders);                         // List inventory orders (with filters)
router.put("/orders/:id/purchased", markOrderPurchased);            // Mark order as purchased

// Inventory Insights routes
router.get("/insights/export", exportInventoryInsights);            // Export insights as CSV (must be before /insights)
router.get("/insights", getInventoryInsights);                      // Get inventory insights

export default router;
