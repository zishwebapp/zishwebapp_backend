export const sheetsConfig = {
  users: {
    sheetName: "Users",
    columns: ["id", "name", "email", "password", "role", "created_at"],
    headers: ["User ID", "Full Name", "Email Address", "Password Hash", "Role", "Registration Date"]
  },

  menu_items: {
    sheetName: "Menu_Items",
    columns: ["id", "item_name", "price", "category", "availability"],
    headers: ["Item ID", "Item Name", "Price", "Category", "Availability Status"]
  },

  orders: {
    sheetName: "Orders",
    columns: ["id", "customer_name", "customer_phone", "customer_email", "total_amount", "order_status", "payment_status", "payment_method", "special_instructions", "created_at"],
    headers: ["Order ID", "Customer Name", "Phone", "Email", "Total Amount", "Order Status", "Payment Status", "Payment Method", "Special Instructions", "Order Date"]
  },

  order_items: {
    sheetName: "Order_Items",
    columns: ["id", "order_id", "menu_item_id", "item_name", "item_price", "quantity", "subtotal", "special_instructions"],
    headers: ["Item ID", "Order ID", "Menu Item ID", "Item Name", "Price", "Quantity", "Subtotal", "Special Instructions"]
  },

  order_status_history: {
    sheetName: "Order_Status_History",
    columns: ["id", "order_id", "old_status", "new_status", "changed_by", "timestamp"],
    headers: ["History ID", "Order ID", "Old Status", "New Status", "Changed By", "Timestamp"]
  },

  feedback: {
    sheetName: "Feedback",
    columns: ["id", "order_id", "rating", "comment", "created_at"],
    headers: ["Feedback ID", "Order ID", "Rating", "Comment", "Submission Date"]
  },

  inventory_items: {
    sheetName: "Inventory_Items",
    columns: ["id", "name", "unit", "current_stock", "reorder_level"],
    headers: ["Item ID", "Item Name", "Unit", "Current Stock", "Reorder Level"]
  },

  inventory_orders: {
    sheetName: "Inventory_Orders",
    columns: ["id", "supplier_name", "total_cost", "created_at"],
    headers: ["Order ID", "Supplier Name", "Total Cost", "Order Date"]
  },

  inventory_order_items: {
    sheetName: "Inventory_Order_Items",
    columns: ["id", "inventory_order_id", "inventory_item_id", "quantity", "cost"],
    headers: ["Line Item ID", "Inventory Order ID", "Inventory Item ID", "Quantity", "Cost"]
  },

  inventory_order_status_history: {
    sheetName: "Inventory_Order_Status_History",
    columns: ["id", "inventory_order_id", "status", "timestamp"],
    headers: ["History ID", "Inventory Order ID", "Status", "Timestamp"]
  }
};