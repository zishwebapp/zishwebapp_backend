import { getAll } from "../services/sheetService.js";
import { getTodayRange, resolveDateRange, isWithinRange } from "../services/dateRange.js";

function sumAmount(items, field) {
  return items.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);
}

// Formats a Date as YYYY-MM-DD in Asia/Kolkata, so the displayed range
// matches the café's local date rather than the server's UTC date.
function formatKolkataDate(date) {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * GET /api/dashboard/summary - All 8 dashboard cards in a single response.
 * Query params: range (week|month|custom), start, end
 *
 * Fixed "today" numbers are always for the current day, regardless of the
 * range filter; the "period" numbers follow whatever range is selected.
 * Expense/profit are computed here, never stored — flipping an entry to
 * "purchased" is reflected the instant this endpoint is called again.
 */
export async function getDashboardSummary(req, res) {
  try {
    const { range, start, end } = req.query;

    const today = getTodayRange();
    const period = resolveDateRange(range, start, end);

    const [sales, inventoryEntries] = await Promise.all([
      getAll("sales"),
      getAll("inventory_entries")
    ]);

    const purchasedEntries = inventoryEntries.filter(e => e.status === "purchased");
    const pendingEntries = inventoryEntries.filter(e => (e.status || "pending") === "pending");

    // Today (fixed)
    const todaySales = sales.filter(s => isWithinRange(s.sale_date, today.startDate, today.endDate));
    const todayPurchased = purchasedEntries.filter(e => isWithinRange(e.purchased_at, today.startDate, today.endDate));

    const todaySalesTotal = sumAmount(todaySales, "amount");
    const todayExpenseTotal = sumAmount(todayPurchased, "total_cost");

    // Period (follows the selected filter)
    const periodSales = sales.filter(s => isWithinRange(s.sale_date, period.startDate, period.endDate));
    const periodPurchased = purchasedEntries.filter(e => isWithinRange(e.purchased_at, period.startDate, period.endDate));

    const periodSalesTotal = sumAmount(periodSales, "amount");
    const periodExpenseTotal = sumAmount(periodPurchased, "total_cost");

    res.json({
      success: true,
      data: {
        today: {
          sales: todaySalesTotal,
          inventory_expense: todayExpenseTotal,
          net_profit: todaySalesTotal - todayExpenseTotal
        },
        period: {
          range: range || "month",
          start: formatKolkataDate(period.startDate),
          end: formatKolkataDate(period.endDate),
          sales: periodSalesTotal,
          inventory_expense: periodExpenseTotal,
          net_profit: periodSalesTotal - periodExpenseTotal
        },
        pending_inventory: {
          count: pendingEntries.length,
          amount: sumAmount(pendingEntries, "total_cost")
        },
        purchased_inventory: {
          count: periodPurchased.length,
          amount: periodExpenseTotal
        }
      }
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard summary",
      error: error.message
    });
  }
}
