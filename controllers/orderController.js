import { getAll, create, bulkCreate, getById } from "../services/sheetService.js";

/**
 * POST /api/orders - Place a new order
 */
export async function placeOrder(req, res) {
  try {
    const { customerName, customerPhone, customerEmail, items, specialInstructions } = req.body;

    // Validate required fields
    if (!customerName || !items || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: "Customer name and items are required" 
      });
    }

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}`;
    console.log(`Creating order: ${orderId} for ${customerName}`);

    // Fetch all menu items to validate and get prices
    const menuItems = await getAll("menu_items");
    
    // Calculate total and prepare order items
    let totalAmount = 0;
    const orderItemsData = [];

    for (const item of items) {
      const menuItem = menuItems.find(m => m.id == item.menuItemId);
      
      if (!menuItem) {
        return res.status(404).json({ 
          success: false, 
          message: `Menu item with ID ${item.menuItemId} not found` 
        });
      }

      // Check availability
      const avail = (menuItem.availability || "").toLowerCase();
      if (avail !== "available" && avail !== "true"){
        return res.status(400).json({
          success: false,
          message: `Menu item "${menuItem.item_name}" is not available`
        });
      }

      const itemPrice = Number(menuItem.price) || 0;
      const subtotal = itemPrice * Number(item.quantity);
      totalAmount += subtotal;

      orderItemsData.push({
        id: `OI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        order_id: orderId,
        menu_item_id: menuItem.id,
        item_name: menuItem.item_name,
        item_price: itemPrice,
        quantity: item.quantity,
        subtotal: subtotal.toFixed(2),
        special_instructions: item.specialInstructions || ""
      });
    }

    // Create order record
    const orderData = {
      id: orderId,
      customer_name: customerName,
      customer_phone: customerPhone || "",
      customer_email: customerEmail || "",
      total_amount: totalAmount.toFixed(2),
      order_status: "pending",
      payment_status: "unpaid",
      payment_method: "cash",
      special_instructions: specialInstructions || "",
      created_at: new Date().toISOString()
    };

    console.log(`Inserting order with ${orderItemsData.length} items...`);

    // Create order in Google Sheets
    await create("orders", orderData);

    // Create order items (bulk insert for efficiency)
    await bulkCreate("order_items", orderItemsData);

    // Create initial status history entry
    await create("order_status_history", {
      id: `OSH-${Date.now()}`,
      order_id: orderId,
      old_status: "",
      new_status: "pending",
      changed_by: "system",
      timestamp: new Date().toISOString()
    });

    console.log(`Order ${orderId} created successfully`);

    res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        id: orderId,
        customerName,
        totalAmount: totalAmount.toFixed(2),
        status: "pending",
        items: orderItemsData.map(item => ({
          itemName: item.item_name,
          quantity: item.quantity,
          price: item.item_price,
          subtotal: item.subtotal
        })),
        createdAt: orderData.created_at
      }
    });

  } catch (error) {
    console.error("Place order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to place order",
      error: error.message
    });
  }
}

/**
 * GET /api/orders - Get all orders
 */
export async function getAllOrders(req, res) {
  try {
    console.log("Fetching all orders...");
    
    // Get all orders from current quarter
    const orders = await getAll("orders");
    
    // Optionally get order items for each order
    const orderItems = await getAll("order_items");
    
    // Combine orders with their items
    const ordersWithItems = orders.map(order => {
      const items = orderItems.filter(item => item.order_id === order.id);
      return {
        ...order,
        items: items.map(item => ({
          itemName: item.item_name,
          quantity: Number(item.quantity),
          price: Number(item.item_price),
          subtotal: Number(item.subtotal)
        })),
        itemCount: items.length
      };
    });

    res.json({
      success: true,
      count: ordersWithItems.length,
      data: ordersWithItems
    });

  } catch (error) {
    console.error("Get all orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message
    });
  }
}

/**
 * GET /api/orders/:id - Get single order by ID
 */
export async function getOrderById(req, res) {
  try {
    const { id } = req.params;
    console.log(`Fetching order: ${id}`);

    // Get order
    const orderResult = await getById("orders", id);
    
    if (!orderResult) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Get order items
    const allOrderItems = await getAll("order_items");
    const items = allOrderItems.filter(item => item.order_id === id);

    // Get status history
    const allHistory = await getAll("order_status_history");
    const statusHistory = allHistory.filter(h => h.order_id === id);

    res.json({
      success: true,
      data: {
        ...orderResult.data,
        items: items.map(item => ({
          itemName: item.item_name,
          quantity: Number(item.quantity),
          price: Number(item.item_price),
          subtotal: Number(item.subtotal),
          specialInstructions: item.special_instructions
        })),
        statusHistory: statusHistory.map(h => ({
          oldStatus: h.old_status,
          newStatus: h.new_status,
          changedBy: h.changed_by,
          timestamp: h.timestamp
        }))
      }
    });

  } catch (error) {
    console.error("Get order by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message
    });
  }
}

/**
 * PUT /api/orders/:id/status - Update order status
 */
export async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, changedBy } = req.body;

    // Validate status
    const validStatuses = ["pending", "preparing", "ready", "completed", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      });
    }

    console.log(`Updating order ${id} status to: ${status}`);

    // Get current order
    const orderResult = await getById("orders", id);
    
    if (!orderResult) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const oldStatus = orderResult.data.order_status;

    // Check if order is already cancelled
    if (oldStatus === "cancelled" && status !== "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot change status of a cancelled order"
      });
    }

    // Update order status (using sheetService update)
    const { update } = await import("../services/sheetService.js");
    await update("orders", id, { order_status: status });

    // Create status history entry
    await create("order_status_history", {
      id: `OSH-${Date.now()}`,
      order_id: id,
      old_status: oldStatus,
      new_status: status,
      changed_by: changedBy || "admin",
      timestamp: new Date().toISOString()
    });

    console.log(`Order ${id} status updated: ${oldStatus} → ${status}`);

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: {
        orderId: id,
        oldStatus,
        newStatus: status,
        changedBy: changedBy || "admin"
      }
    });

  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message
    });
  }
}

/**
 * PUT /api/orders/:id/payment - Update payment status
 */
export async function updatePaymentStatus(req, res) {
  try {
    const { id } = req.params;
    const { paymentStatus, paymentMethod } = req.body;

    // Validate payment status
    const validStatuses = ["unpaid", "paid"];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Must be one of: ${validStatuses.join(", ")}`
      });
    }

    console.log(`Updating order ${id} payment status to: ${paymentStatus}`);

    // Get current order
    const orderResult = await getById("orders", id);
    
    if (!orderResult) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Update payment status and optionally payment method
    const { update } = await import("../services/sheetService.js");
    const updates = { payment_status: paymentStatus };
    if (paymentMethod) {
      updates.payment_method = paymentMethod;
    }
    
    await update("orders", id, updates);

    console.log(`Order ${id} payment status updated to: ${paymentStatus}`);

    res.json({
      success: true,
      message: "Payment status updated successfully",
      data: {
        orderId: id,
        paymentStatus,
        paymentMethod: paymentMethod || orderResult.data.payment_method
      }
    });

  } catch (error) {
    console.error("Update payment status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update payment status",
      error: error.message
    });
  }
}

/**
 * GET /api/orders/customer/:phone - Get orders by customer phone
 */
export async function getOrdersByCustomer(req, res) {
  try {
    const { phone } = req.params;
    console.log(`Fetching orders for customer phone: ${phone}`);

    // Get all orders
    const orders = await getAll("orders");
    
    // Filter by phone (partial match)
    const customerOrders = orders.filter(order => 
      order.customer_phone && order.customer_phone.includes(phone)
    );

    if (customerOrders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No orders found for this phone number"
      });
    }

    // Get all order items
    const orderItems = await getAll("order_items");

    // Attach items to each order
    const ordersWithItems = customerOrders.map(order => {
      const items = orderItems.filter(item => item.order_id === order.id);
      return {
        ...order,
        items: items.map(item => ({
          itemName: item.item_name,
          quantity: Number(item.quantity),
          price: Number(item.item_price),
          subtotal: Number(item.subtotal)
        })),
        itemCount: items.length
      };
    });

    res.json({
      success: true,
      count: ordersWithItems.length,
      customerPhone: phone,
      data: ordersWithItems
    });

  } catch (error) {
    console.error("Get orders by customer error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer orders",
      error: error.message
    });
  }
}
