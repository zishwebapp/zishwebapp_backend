import { getAll, create, bulkCreate, getById, update, remove } from "../services/sheetService.js";
import { generateId } from "../services/idGenerator.js";
import { isMenuItemAvailable } from "../services/menuAvailability.js";

function generateOrderItemId() {
  return `OI-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Sums subtotal across a list of order_items rows, e.g. as returned by getAll("order_items")
function sumSubtotals(items) {
  return items.reduce((sum, item) => sum + Number(item.subtotal), 0);
}

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
    const orderId = generateId("ORD");
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
      if (!isMenuItemAvailable(menuItem.availability)) {
        return res.status(400).json({
          success: false,
          message: `Menu item "${menuItem.item_name}" is not available`
        });
      }

      const itemPrice = Number(menuItem.price) || 0;
      const subtotal = itemPrice * Number(item.quantity);
      totalAmount += subtotal;

      orderItemsData.push({
        id: generateOrderItemId(),
        order_id: orderId,
        menu_item_id: menuItem.id,
        item_name: menuItem.item_name,
        item_price: itemPrice,
        quantity: item.quantity,
        subtotal: subtotal.toFixed(2),
        special_instructions: item.specialInstructions || "",
        item_status: "pending"
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
      id: generateId("OSH"),
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
          id: item.id,
          itemName: item.item_name,
          quantity: item.quantity,
          price: item.item_price,
          subtotal: item.subtotal,
          itemStatus: item.item_status
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
 * Returns orders sorted by creation date (newest first) with edge case handling
 */
export async function getAllOrders(req, res) {
  try {
    console.log("Fetching all orders...");
    
    // Get all orders from current quarter
    const orders = await getAll("orders");
    
    // Get order items for each order
    const orderItems = await getAll("order_items");
    
    // Detect orphaned order items (items without parent order)
    const validOrderIds = new Set(orders.map(o => o.id));
    const orphanedItems = orderItems.filter(item => !validOrderIds.has(item.order_id));
    
    if (orphanedItems.length > 0) {
      console.warn(`⚠️  Found ${orphanedItems.length} orphaned order items (no parent order):`, 
        orphanedItems.map(i => `Item ID: ${i.id}, Order ID: ${i.order_id}`));
    }
    
    // Combine orders with their items
    const ordersWithItems = orders.map(order => {
      const items = orderItems.filter(item => item.order_id === order.id);
      
      // Edge case: Order without items (data integrity issue)
      if (items.length === 0) {
        console.warn(`⚠️  Order ${order.id} has no items (orphaned order)`);
      }
      
      return {
        ...order,
        items: items.map(item => ({
          id: item.id,
          itemName: item.item_name,
          quantity: Number(item.quantity),
          price: Number(item.item_price),
          subtotal: Number(item.subtotal),
          specialInstructions: item.special_instructions,
          itemStatus: item.item_status || "pending"
        })),
        itemCount: items.length,
        isOrphaned: items.length === 0 // Flag for frontend
      };
    });

    // SORT BY CREATED_AT DESCENDING (newest orders first)
    ordersWithItems.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA; // Descending order
    });

    res.json({
      success: true,
      count: ordersWithItems.length,
      data: ordersWithItems,
      warnings: {
        orphanedItems: orphanedItems.length,
        orphanedOrders: ordersWithItems.filter(o => o.isOrphaned).length
      }
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
          id: item.id,
          itemName: item.item_name,
          quantity: Number(item.quantity),
          price: Number(item.item_price),
          subtotal: Number(item.subtotal),
          specialInstructions: item.special_instructions,
          itemStatus: item.item_status || "pending"
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
    await update("orders", id, { order_status: status });

    // Create status history entry
    await create("order_status_history", {
      id: generateId("OSH"),
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
 * PUT /api/orders/:orderId/items/:itemId/status - Update a single item's delivery status
 * Lets the kitchen mark individual items as delivered when they go out one at a time,
 * instead of only being able to flip the whole order's status at once.
 */
export async function updateOrderItemStatus(req, res) {
  try {
    const { orderId, itemId } = req.params;
    const { itemStatus } = req.body;

    const validItemStatuses = ["pending", "delivered"];
    if (!validItemStatuses.includes(itemStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid item status. Must be one of: ${validItemStatuses.join(", ")}`
      });
    }

    console.log(`Updating item ${itemId} (order ${orderId}) status to: ${itemStatus}`);

    // Look these up via getAll (cached for 30s) instead of getById (which always
    // hits the live Google Sheets API). This endpoint is called once per item
    // tapped, so keeping it cache-friendly matters for staying under the
    // Sheets API's 60-requests-per-minute quota (see GOOGLE_SHEETS_QUOTA_ISSUE.md).
    const orders = await getAll("orders");
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const allOrderItems = await getAll("order_items");
    const item = allOrderItems.find(i => i.id === itemId && i.order_id === orderId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    if (order.order_status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cannot update items on a cancelled order"
      });
    }

    await update("order_items", itemId, { item_status: itemStatus });

    // If every item on the order is now delivered, auto-advance the order
    // to "ready" so the order list reflects reality without a manual click.
    // Only does this from pending/preparing so it never overrides a status
    // an admin already set further along (ready/completed) or backward.
    // Reuses the item list already fetched above instead of re-fetching
    // (the write above just invalidated the cache, so a re-fetch here would
    // force another live API call).
    let orderStatusBumped = false;
    if (["pending", "preparing"].includes(order.order_status)) {
      const itemsForOrder = allOrderItems.filter(i => i.order_id === orderId);
      const allDelivered = itemsForOrder.length > 0 &&
        itemsForOrder.every(i =>
          i.id === itemId ? itemStatus === "delivered" : i.item_status === "delivered"
        );

      if (allDelivered) {
        await update("orders", orderId, { order_status: "ready" });
        await create("order_status_history", {
          id: generateId("OSH"),
          order_id: orderId,
          old_status: order.order_status,
          new_status: "ready",
          changed_by: "system (all items delivered)",
          timestamp: new Date().toISOString()
        });
        orderStatusBumped = true;
      }
    }

    console.log(`Item ${itemId} status updated to: ${itemStatus}`);

    res.json({
      success: true,
      message: "Item status updated successfully",
      data: {
        orderId,
        itemId,
        itemStatus,
        orderStatusBumpedToReady: orderStatusBumped
      }
    });

  } catch (error) {
    console.error("Update order item status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update item status",
      error: error.message
    });
  }
}

/**
 * POST /api/orders/:orderId/items - Add a new item to an existing order
 * Lets an admin add something the customer asks for after the order was placed,
 * without needing to cancel and re-place the whole order.
 */
export async function addOrderItem(req, res) {
  try {
    const { orderId } = req.params;
    const { menuItemId, quantity, specialInstructions } = req.body;

    if (!menuItemId || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "menuItemId and a whole-number quantity of at least 1 are required"
      });
    }

    const orders = await getAll("orders");
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const menuItems = await getAll("menu_items");
    const menuItem = menuItems.find(m => m.id == menuItemId);
    if (!menuItem) {
      return res.status(404).json({
        success: false,
        message: `Menu item with ID ${menuItemId} not found`
      });
    }

    if (!isMenuItemAvailable(menuItem.availability)) {
      return res.status(400).json({
        success: false,
        message: `Menu item "${menuItem.item_name}" is not available`
      });
    }

    const itemPrice = Number(menuItem.price) || 0;
    const subtotal = itemPrice * quantity;

    const newItem = {
      id: generateOrderItemId(),
      order_id: orderId,
      menu_item_id: menuItem.id,
      item_name: menuItem.item_name,
      item_price: itemPrice,
      quantity,
      subtotal: subtotal.toFixed(2),
      special_instructions: specialInstructions || "",
      item_status: "pending"
    };

    await create("order_items", newItem);

    // Recalculate the order total from items already known (existing items
    // fetched above are unaffected by this add) plus the new item, instead
    // of re-fetching order_items and burning another Sheets API call.
    const existingItems = await getAll("order_items");
    const existingItemsForOrder = existingItems.filter(i => i.order_id === orderId && i.id !== newItem.id);
    const newTotal = sumSubtotals(existingItemsForOrder) + subtotal;
    await update("orders", orderId, { total_amount: newTotal.toFixed(2) });

    console.log(`Added item "${menuItem.item_name}" x${quantity} to order ${orderId}`);

    res.status(201).json({
      success: true,
      message: "Item added to order",
      data: {
        orderId,
        item: {
          id: newItem.id,
          itemName: newItem.item_name,
          quantity: newItem.quantity,
          price: newItem.item_price,
          subtotal: Number(newItem.subtotal),
          itemStatus: newItem.item_status
        },
        newTotalAmount: newTotal.toFixed(2)
      }
    });

  } catch (error) {
    console.error("Add order item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add item to order",
      error: error.message
    });
  }
}

/**
 * PUT /api/orders/:orderId/items/:itemId/quantity - Change an existing item's quantity
 */
export async function updateOrderItemQuantity(req, res) {
  try {
    const { orderId, itemId } = req.params;
    const { quantity } = req.body;

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be a whole number of at least 1. To remove the item entirely, use the remove option instead."
      });
    }

    const orders = await getAll("orders");
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const orderItems = await getAll("order_items");
    const item = orderItems.find(i => i.id === itemId && i.order_id === orderId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    const newSubtotal = Number(item.item_price) * quantity;
    await update("order_items", itemId, { quantity, subtotal: newSubtotal.toFixed(2) });

    // Recompute total using the item list already in hand, swapping in the new subtotal.
    const itemsForOrder = orderItems.filter(i => i.order_id === orderId);
    const newTotal = itemsForOrder.reduce((sum, i) => sum + (i.id === itemId ? newSubtotal : Number(i.subtotal)), 0);
    await update("orders", orderId, { total_amount: newTotal.toFixed(2) });

    console.log(`Updated item ${itemId} on order ${orderId} to quantity ${quantity}`);

    res.json({
      success: true,
      message: "Item quantity updated",
      data: {
        orderId,
        itemId,
        quantity,
        subtotal: newSubtotal.toFixed(2),
        newTotalAmount: newTotal.toFixed(2)
      }
    });

  } catch (error) {
    console.error("Update order item quantity error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update item quantity",
      error: error.message
    });
  }
}

/**
 * DELETE /api/orders/:orderId/items/:itemId - Remove an item from an order
 * Refuses to remove the last remaining item — an order with zero items doesn't
 * make sense, so the admin should cancel the order instead.
 */
export async function removeOrderItem(req, res) {
  try {
    const { orderId, itemId } = req.params;

    const orders = await getAll("orders");
    const order = orders.find(o => o.id === orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const orderItems = await getAll("order_items");
    const itemsForOrder = orderItems.filter(i => i.order_id === orderId);
    const item = itemsForOrder.find(i => i.id === itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Order item not found"
      });
    }

    if (itemsForOrder.length === 1) {
      return res.status(400).json({
        success: false,
        code: "LAST_ITEM",
        message: "This is the last item on the order. Cancel the order instead of removing its only item."
      });
    }

    await remove("order_items", itemId);

    const newTotal = sumSubtotals(itemsForOrder.filter(i => i.id !== itemId));
    await update("orders", orderId, { total_amount: newTotal.toFixed(2) });

    console.log(`Removed item ${itemId} from order ${orderId}`);

    res.json({
      success: true,
      message: "Item removed from order",
      data: {
        orderId,
        itemId,
        newTotalAmount: newTotal.toFixed(2)
      }
    });

  } catch (error) {
    console.error("Remove order item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove item from order",
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
          id: item.id,
          itemName: item.item_name,
          quantity: Number(item.quantity),
          price: Number(item.item_price),
          subtotal: Number(item.subtotal),
          itemStatus: item.item_status || "pending"
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

/**
 * DELETE /api/orders/:id - Delete order and all related records
 * Removes order from orders, order_items, and order_status_history sheets
 */
export async function deleteOrder(req, res) {
  try {
    const { id } = req.params;
    console.log(`Deleting order: ${id}`);

    // Import remove functions
    const { remove, removeMultiple } = await import("../services/sheetService.js");

    // Step 1: Verify order exists
    const orderResult = await getById("orders", id);
    if (!orderResult) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Step 2: Delete all order items (single batched request instead of one call per row)
    const orderItems = await getAll("order_items");
    const itemsToDelete = orderItems.filter(item => item.order_id === id);

    console.log(`Deleting ${itemsToDelete.length} order items...`);
    await removeMultiple("order_items", itemsToDelete.map(item => item.id));

    // Step 3: Delete all status history entries (single batched request)
    const statusHistory = await getAll("order_status_history");
    const historyToDelete = statusHistory.filter(h => h.order_id === id);

    console.log(`Deleting ${historyToDelete.length} status history entries...`);
    await removeMultiple("order_status_history", historyToDelete.map(h => h.id));

    // Step 4: Delete the order itself
    await remove("orders", id);

    console.log(`✅ Order ${id} and all related records deleted successfully`);

    res.json({
      success: true,
      message: "Order deleted successfully",
      data: {
        orderId: id,
        deletedItems: itemsToDelete.length,
        deletedHistory: historyToDelete.length
      }
    });

  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete order",
      error: error.message
    });
  }
}

/**
 * GET /api/orders/stats/orders - Get order statistics
 * Returns count of orders created today
 */
export async function getOrderStats(req, res) {
  try {
    console.log("Fetching order statistics...");

    // Get all orders
    const orders = await getAll("orders");
    
    // Get today's date (start of day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Count orders created today (exclude cancelled)
    const ordersToday = orders.filter(order => {
      if (!order.created_at) return false;
      
      const orderDate = new Date(order.created_at);
      orderDate.setHours(0, 0, 0, 0);
      
      // Exclude cancelled orders
      return orderDate.getTime() === today.getTime() && 
             order.order_status !== 'cancelled';
    });

    res.json({
      success: true,
      data: {
        orders_today: ordersToday.length
      }
    });

  } catch (error) {
    console.error("Get order stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order statistics",
      error: error.message
    });
  }
}

/**
 * GET /api/orders/integrity-check - Check data integrity
 * Returns information about orphaned records
 */
export async function checkDataIntegrity(req, res) {
  try {
    console.log("Running data integrity check...");

    const orders = await getAll("orders");
    const orderItems = await getAll("order_items");
    const statusHistory = await getAll("order_status_history");

    // Find orphaned order items (items without parent order)
    const validOrderIds = new Set(orders.map(o => o.id));
    const orphanedItems = orderItems.filter(item => !validOrderIds.has(item.order_id));

    // Find orphaned status history (history without parent order)
    const orphanedHistory = statusHistory.filter(h => !validOrderIds.has(h.order_id));

    // Find orders without items (orphaned orders)
    const ordersWithoutItems = orders.filter(order => {
      return !orderItems.some(item => item.order_id === order.id);
    });

    const hasIssues = orphanedItems.length > 0 || orphanedHistory.length > 0 || ordersWithoutItems.length > 0;

    res.json({
      success: true,
      hasIssues,
      data: {
        totalOrders: orders.length,
        totalOrderItems: orderItems.length,
        totalStatusHistory: statusHistory.length,
        orphanedOrderItems: orphanedItems.length,
        orphanedStatusHistory: orphanedHistory.length,
        ordersWithoutItems: ordersWithoutItems.length,
        details: {
          orphanedItems: orphanedItems.map(i => ({
            id: i.id,
            orderId: i.order_id,
            itemName: i.item_name
          })),
          orphanedHistory: orphanedHistory.map(h => ({
            id: h.id,
            orderId: h.order_id
          })),
          ordersWithoutItems: ordersWithoutItems.map(o => ({
            id: o.id,
            customerName: o.customer_name
          }))
        }
      }
    });

  } catch (error) {
    console.error("Data integrity check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check data integrity",
      error: error.message
    });
  }
}
