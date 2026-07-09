import { getAll, create, getById, update, remove } from "../services/sheetService.js";
import { generateId } from "../services/idGenerator.js";
import { resolveDateRange, isWithinRange } from "../services/dateRange.js";

function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

function transformEntry(entry) {
  return {
    id: entry.id,
    item_name: entry.item_name,
    quantity: parseFloat(entry.quantity) || 0,
    total_cost: parseFloat(entry.total_cost) || 0,
    entry_date: entry.entry_date,
    status: entry.status || "pending",
    purchased_at: entry.purchased_at || null,
    created_by: entry.created_by || "system"
  };
}

/**
 * POST /api/inventory/entries - Add a single inventory purchase entry.
 * Matches the "one popup, few fields" UX: item name, quantity, total cost,
 * date (defaults to today), status (pending/purchased).
 */
export async function createInventoryEntry(req, res) {
  try {
    const { item_name, quantity, total_cost, entry_date, status, created_by } = req.body;

    if (!item_name || quantity === undefined || total_cost === undefined) {
      return res.status(400).json({
        success: false,
        message: "item_name, quantity, and total_cost are required"
      });
    }

    const entryStatus = status === "purchased" ? "purchased" : "pending";
    const id = generateId("INV");

    const data = {
      id,
      item_name,
      quantity: parseFloat(quantity) || 0,
      total_cost: parseFloat(total_cost) || 0,
      entry_date: entry_date || todayDateString(),
      status: entryStatus,
      purchased_at: entryStatus === "purchased" ? new Date().toISOString() : "",
      created_by: created_by || "system"
    };

    await create("inventory_entries", data);

    res.status(201).json({
      success: true,
      message: "Inventory entry added successfully",
      data: transformEntry(data)
    });
  } catch (error) {
    console.error("Create inventory entry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add inventory entry",
      error: error.message
    });
  }
}

/**
 * GET /api/inventory/entries - List inventory entries.
 * Query params: range (week|month|custom), start, end, status (pending|purchased|all), search
 */
export async function listInventoryEntries(req, res) {
  try {
    const { range, start, end, status, search } = req.query;
    const { startDate, endDate } = resolveDateRange(range, start, end);

    let entries = await getAll("inventory_entries");

    entries = entries.filter(e => isWithinRange(e.entry_date, startDate, endDate));

    if (status && status !== "all") {
      entries = entries.filter(e => (e.status || "pending") === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      entries = entries.filter(e => (e.item_name || "").toLowerCase().includes(searchLower));
    }

    entries.sort((a, b) => new Date(b.entry_date || 0).getTime() - new Date(a.entry_date || 0).getTime());

    res.json({
      success: true,
      count: entries.length,
      data: entries.map(transformEntry)
    });
  } catch (error) {
    console.error("List inventory entries error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory entries",
      error: error.message
    });
  }
}

/**
 * PUT /api/inventory/entries/:id - Edit an entry.
 */
export async function updateInventoryEntry(req, res) {
  try {
    const { id } = req.params;
    const { item_name, quantity, total_cost, entry_date, status } = req.body;

    const updates = {};
    if (item_name !== undefined) updates.item_name = item_name;
    if (quantity !== undefined) updates.quantity = parseFloat(quantity) || 0;
    if (total_cost !== undefined) updates.total_cost = parseFloat(total_cost) || 0;
    if (entry_date !== undefined) updates.entry_date = entry_date;

    if (status !== undefined) {
      const existing = await getById("inventory_entries", id);
      if (!existing) {
        return res.status(404).json({ success: false, message: "Inventory entry not found" });
      }
      updates.status = status;
      // Just flipped to purchased for the first time -> stamp the purchase date
      if (status === "purchased" && existing.data.status !== "purchased") {
        updates.purchased_at = new Date().toISOString();
      }
    }

    const updated = await update("inventory_entries", id, updates);

    if (!updated) {
      return res.status(404).json({ success: false, message: "Inventory entry not found" });
    }

    res.json({
      success: true,
      message: "Inventory entry updated successfully",
      data: transformEntry(updated)
    });
  } catch (error) {
    console.error("Update inventory entry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update inventory entry",
      error: error.message
    });
  }
}

/**
 * PATCH /api/inventory/entries/:id/purchase - One-click "Mark Purchased".
 * This is the only place inventory expense comes from: as soon as this
 * flips, the entry's total_cost counts toward expense from here on.
 */
export async function markEntryPurchased(req, res) {
  try {
    const { id } = req.params;

    const existing = await getById("inventory_entries", id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Inventory entry not found" });
    }

    if (existing.data.status === "purchased") {
      return res.status(400).json({ success: false, message: "Entry is already marked as purchased" });
    }

    const updated = await update("inventory_entries", id, {
      status: "purchased",
      purchased_at: new Date().toISOString()
    });

    res.json({
      success: true,
      message: "Marked as purchased",
      data: transformEntry(updated)
    });
  } catch (error) {
    console.error("Mark entry purchased error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark entry as purchased",
      error: error.message
    });
  }
}

/**
 * DELETE /api/inventory/entries/:id
 */
export async function deleteInventoryEntry(req, res) {
  try {
    const { id } = req.params;

    const deleted = await remove("inventory_entries", id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Inventory entry not found" });
    }

    res.json({ success: true, message: "Inventory entry deleted successfully" });
  } catch (error) {
    console.error("Delete inventory entry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete inventory entry",
      error: error.message
    });
  }
}

/**
 * POST /api/inventory/entries/:id/duplicate - Quick "buy this again" action.
 * Duplicates item name/quantity/cost, resets date to today and status to pending.
 */
export async function duplicateInventoryEntry(req, res) {
  try {
    const { id } = req.params;

    const existing = await getById("inventory_entries", id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Inventory entry not found" });
    }

    const data = {
      id: generateId("INV"),
      item_name: existing.data.item_name,
      quantity: existing.data.quantity,
      total_cost: existing.data.total_cost,
      entry_date: todayDateString(),
      status: "pending",
      purchased_at: "",
      created_by: existing.data.created_by || "system"
    };

    await create("inventory_entries", data);

    res.status(201).json({
      success: true,
      message: "Inventory entry duplicated successfully",
      data: transformEntry(data)
    });
  } catch (error) {
    console.error("Duplicate inventory entry error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to duplicate inventory entry",
      error: error.message
    });
  }
}
