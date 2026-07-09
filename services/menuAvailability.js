// Google Sheets is hand-edited by non-developers, so the "availability" cell
// ends up with whatever word felt natural at the time (e.g. "active", copied
// from the inventory items' status convention) rather than one fixed value.
// Recognize the common variants instead of a single exact string.
const AVAILABLE_VALUES = new Set(["available", "true", "active", "yes", "1", "in stock", "instock"]);

export function isMenuItemAvailable(value) {
  const normalized = (value || "").toString().toLowerCase().trim();
  return AVAILABLE_VALUES.has(normalized);
}
