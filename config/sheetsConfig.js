// `partitioned: true`  -> lives in a fresh "Q1_2026_<SheetName>" tab every quarter (time-bound data).
// `partitioned: false` -> lives in ONE permanent "<SheetName>" tab forever (reference/master data).
export const sheetsConfig = {
  users: {
    sheetName: "Users",
    partitioned: false,
    columns: ["id", "name", "email", "password", "role", "created_at"],
    headers: ["User ID", "Full Name", "Email Address", "Password Hash", "Role", "Registration Date"]
  },

  menu_items: {
    sheetName: "Menu_Items",
    partitioned: false,
    columns: ["id", "item_name", "price", "category", "availability"],
    headers: ["Item ID", "Item Name", "Price", "Category", "Availability Status"]
  },

  orders: {
    sheetName: "Orders",
    partitioned: true,
    columns: ["id", "customer_name", "customer_phone", "customer_email", "total_amount", "order_status", "payment_status", "payment_method", "special_instructions", "created_at"],
    headers: ["Order ID", "Customer Name", "Phone", "Email", "Total Amount", "Order Status", "Payment Status", "Payment Method", "Special Instructions", "Order Date"]
  },

  order_items: {
    sheetName: "Order_Items",
    partitioned: true,
    columns: ["id", "order_id", "menu_item_id", "item_name", "item_price", "quantity", "subtotal", "special_instructions", "item_status"],
    headers: ["Item ID", "Order ID", "Menu Item ID", "Item Name", "Price", "Quantity", "Subtotal", "Special Instructions", "Item Status"]
  },

  order_status_history: {
    sheetName: "Order_Status_History",
    partitioned: true,
    columns: ["id", "order_id", "old_status", "new_status", "changed_by", "timestamp"],
    headers: ["History ID", "Order ID", "Old Status", "New Status", "Changed By", "Timestamp"]
  },

  feedback: {
    sheetName: "Feedback",
    partitioned: true,
    columns: ["id", "customer_name", "email", "rating", "feedback", "created_at"],
    headers: ["Feedback ID", "Customer Name", "Email", "Rating", "Feedback", "Submission Date"]
  },

  // One row per purchase: no catalog, no rate x quantity math — the user
  // types the item name and the actual total they paid.
  inventory_entries: {
    sheetName: "Inventory_Entries",
    partitioned: true,
    columns: ["id", "item_name", "quantity", "total_cost", "entry_date", "status", "purchased_at", "created_by"],
    headers: ["Entry ID", "Item Name", "Quantity", "Total Cost (₹)", "Entry Date", "Status", "Purchased Date", "Created By"]
  },

  // Lightweight manual sales log, independent of the full customer-order
  // system — for cash/walk-in sales that don't go through the web ordering flow.
  sales: {
    sheetName: "Sales",
    partitioned: true,
    columns: ["id", "amount", "sale_date", "notes", "created_by", "created_at"],
    headers: ["Sale ID", "Amount (₹)", "Sale Date", "Notes", "Created By", "Created At"]
  }
};