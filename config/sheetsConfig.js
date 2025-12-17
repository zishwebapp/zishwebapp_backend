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
    columns: ["id", "customer_name", "email", "rating", "feedback", "created_at"],
    headers: ["Feedback ID", "Customer Name", "Email", "Rating", "Feedback", "Submission Date"]
  },

  inventory_items: {
    sheetName: "Inventory_Items",
    columns: ["id", "name", "unit_label", "rate", "category", "status", "current_stock", "reorder_level", "created_by", "created_at"],
    headers: ["Item ID", "Item Name", "Unit", "Rate (₹)", "Category", "Status", "Current Stock", "Reorder Level", "Created By", "Created Date"]
  },

  inventory_orders: {
    sheetName: "Inventory_Orders",
    columns: ["id", "ordered_by", "total_amount", "status", "ordered_at", "purchased_at", "purchased_by", "notes"],
    headers: ["Order ID", "Ordered By", "Total Amount (₹)", "Status", "Ordered Date", "Purchased Date", "Purchased By", "Notes"]
  },

  inventory_order_items: {
    sheetName: "Inventory_Order_Items",
    columns: ["id", "inventory_order_id", "inventory_item_id", "item_name", "unit", "rate", "quantity", "line_amount"],
    headers: ["Line Item ID", "Order ID", "Item ID", "Item Name", "Unit", "Rate (₹)", "Quantity", "Line Amount (₹)"]
  }
};