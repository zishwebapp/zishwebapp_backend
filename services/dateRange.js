/**
 * Shared date-range resolution for the Inventory/Sales dashboard.
 * Supports the three presets the frontend's date filter offers
 * (This Week, This Month, Custom Range) plus a fixed "today" range that
 * doesn't depend on the filter at all.
 *
 * All "today"-relative boundaries are computed in Asia/Kolkata, matching
 * the convention already used in statsController.js/feedbackController.js —
 * otherwise "today" would roll over at server-local midnight instead of
 * the café's actual midnight (Render/most hosts run servers in UTC).
 */

function nowInKolkata() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

export function getTodayRange() {
  const start = nowInKolkata();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setHours(23, 59, 59, 999);

  return { startDate: start, endDate: end };
}

function getThisWeekRange() {
  const start = nowInKolkata();
  start.setHours(0, 0, 0, 0);

  // Monday-based week
  const dayOfWeek = start.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  start.setDate(start.getDate() - daysToMonday);

  const end = nowInKolkata();
  end.setHours(23, 59, 59, 999);

  return { startDate: start, endDate: end };
}

function getThisMonthRange() {
  const today = nowInKolkata();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = nowInKolkata();
  end.setHours(23, 59, 59, 999);

  return { startDate: start, endDate: end };
}

/**
 * Resolves the "range" query param (+ optional start/end for custom) into
 * concrete Date bounds. Defaults to "This Month" if range is missing/unknown.
 */
export function resolveDateRange(range, start, end) {
  if (range === "week") return getThisWeekRange();
  if (range === "custom" && start && end) {
    const startDate = new Date(start);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    return { startDate, endDate };
  }
  return getThisMonthRange();
}

export function isWithinRange(dateValue, startDate, endDate) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  return d >= startDate && d <= endDate;
}
