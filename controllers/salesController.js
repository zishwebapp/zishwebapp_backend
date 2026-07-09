import { getAll, create, remove } from "../services/sheetService.js";
import { generateId } from "../services/idGenerator.js";
import { resolveDateRange, isWithinRange } from "../services/dateRange.js";

function todayDateString() {
  return new Date().toISOString().split("T")[0];
}

function transformSale(sale) {
  return {
    id: sale.id,
    amount: parseFloat(sale.amount) || 0,
    sale_date: sale.sale_date,
    notes: sale.notes || "",
    created_by: sale.created_by || "system",
    created_at: sale.created_at
  };
}

/**
 * POST /api/sales - Log a manual sale (cash/walk-in, not through web ordering).
 */
export async function createSale(req, res) {
  try {
    const { amount, sale_date, notes, created_by } = req.body;

    if (amount === undefined || amount === null || amount === "") {
      return res.status(400).json({ success: false, message: "amount is required" });
    }

    const data = {
      id: generateId("SALE"),
      amount: parseFloat(amount) || 0,
      sale_date: sale_date || todayDateString(),
      notes: notes || "",
      created_by: created_by || "system",
      created_at: new Date().toISOString()
    };

    await create("sales", data);

    res.status(201).json({
      success: true,
      message: "Sale logged successfully",
      data: transformSale(data)
    });
  } catch (error) {
    console.error("Create sale error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to log sale",
      error: error.message
    });
  }
}

/**
 * GET /api/sales - List sales. Query params: range (week|month|custom), start, end, search (notes)
 */
export async function listSales(req, res) {
  try {
    const { range, start, end, search } = req.query;
    const { startDate, endDate } = resolveDateRange(range, start, end);

    let sales = await getAll("sales");

    sales = sales.filter(s => isWithinRange(s.sale_date, startDate, endDate));

    if (search) {
      const searchLower = search.toLowerCase();
      sales = sales.filter(s => (s.notes || "").toLowerCase().includes(searchLower));
    }

    sales.sort((a, b) => new Date(b.sale_date || 0).getTime() - new Date(a.sale_date || 0).getTime());

    res.json({
      success: true,
      count: sales.length,
      data: sales.map(transformSale)
    });
  } catch (error) {
    console.error("List sales error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales",
      error: error.message
    });
  }
}

/**
 * DELETE /api/sales/:id
 */
export async function deleteSale(req, res) {
  try {
    const { id } = req.params;

    const deleted = await remove("sales", id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    res.json({ success: true, message: "Sale deleted successfully" });
  } catch (error) {
    console.error("Delete sale error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete sale",
      error: error.message
    });
  }
}
