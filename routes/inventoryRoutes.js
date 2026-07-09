import express from "express";
import {
  createInventoryEntry,
  listInventoryEntries,
  updateInventoryEntry,
  markEntryPurchased,
  deleteInventoryEntry,
  duplicateInventoryEntry
} from "../controllers/inventoryController.js";

const router = express.Router();

router.get("/entries", listInventoryEntries);                       // List entries (range/status/search filters)
router.post("/entries", createInventoryEntry);                      // Add entry (one popup)
router.put("/entries/:id", updateInventoryEntry);                   // Edit entry
router.patch("/entries/:id/purchase", markEntryPurchased);          // One-click Mark Purchased
router.delete("/entries/:id", deleteInventoryEntry);                // Delete entry
router.post("/entries/:id/duplicate", duplicateInventoryEntry);     // Duplicate entry

export default router;
