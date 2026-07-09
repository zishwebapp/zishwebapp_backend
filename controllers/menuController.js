import { getAll } from "../services/sheetService.js";
import { isMenuItemAvailable } from "../services/menuAvailability.js";

export async function getMenuItems(req, res) {
  try {
    // Reads from the same permanent "menu_items" tab that order placement
    // validates against, so the two can never disagree about what's on the menu.
    const items = await getAll("menu_items");

    const menu = items.map(item => ({
      id: item.id ?? null,
      name: item.item_name ?? "",
      price: item.price ? Number(item.price) : null,
      category_id: item.category ? Number(item.category) : null,
      description: "", // Not stored in Google Sheets
      image_url: "", // Not stored in Google Sheets
      is_available: isMenuItemAvailable(item.availability),
      preparation_time_minutes: null, // Not stored in Google Sheets
      created_at: null,
      updated_at: null
    }));

    res.json({
      success: true,
      count: menu.length,
      menu
    });

  } catch (error) {
    console.error("MENU FETCH ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Error loading menu items",
      error: error.message
    });
  }
}
