import { getAll, create, bulkCreate, getById, update, remove } from "../services/sheetService.js";

/**
 * GET /api/inventory/items - Get inventory items
 * Query params: status (active | inactive | all)
 */
export async function getInventoryItems(req, res) {
  try {
    const { status = 'active' } = req.query;
    console.log(`Fetching inventory items with status: ${status}`);

    let items = await getAll("inventory_items");

    // Filter by status if not 'all'
    if (status !== 'all') {
      items = items.filter(item => (item.status || 'active') === status);
    }

    // Transform to frontend format
    const transformedItems = items.map(item => ({
      id: parseInt(item.id.replace('INV-ITEM-', '')) || parseInt(item.id),
      name: item.name,
      unit_label: item.unit_label,
      rate: parseFloat(item.rate) || 0,
      category: item.category || '',
      status: item.status || 'active',
      current_stock: parseFloat(item.current_stock) || 0,
      reorder_level: parseFloat(item.reorder_level) || 0
    }));

    res.json({
      success: true,
      count: transformedItems.length,
      data: transformedItems
    });

  } catch (error) {
    console.error("Get inventory items error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory items",
      error: error.message
    });
  }
}

/**
 * POST /api/inventory/items - Create inventory item
 */
export async function createInventoryItem(req, res) {
  try {
    const { name, unit_label, rate, category, status, created_by } = req.body;

    // Validate required fields
    if (!name || !unit_label || rate === undefined) {
      return res.status(400).json({
        success: false,
        message: "Name, unit_label, and rate are required"
      });
    }

    const itemId = `INV-ITEM-${Date.now()}`;
    console.log(`Creating inventory item: ${itemId} - ${name}`);

    const itemData = {
      id: itemId,
      name,
      unit_label,
      rate: parseFloat(rate),
      category: category || '',
      status: status || 'active',
      current_stock: 0,
      reorder_level: 0,
      created_by: created_by || 'system',
      created_at: new Date().toISOString()
    };

    await create("inventory_items", itemData);

    console.log(`Inventory item ${itemId} created successfully`);

    res.status(201).json({
      success: true,
      message: "Inventory item created successfully",
      data: {
        id: parseInt(itemId.replace('INV-ITEM-', '')),
        name: itemData.name,
        unit_label: itemData.unit_label,
        rate: itemData.rate,
        category: itemData.category,
        status: itemData.status
      }
    });

  } catch (error) {
    console.error("Create inventory item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create inventory item",
      error: error.message
    });
  }
}

/**
 * PUT /api/inventory/items/:id - Update inventory item
 */
export async function updateInventoryItem(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log(`Updating inventory item: ${id}`);

    // Find item with ID (could be numeric or INV-ITEM- prefixed)
    const items = await getAll("inventory_items");
    const item = items.find(i => 
      i.id === `INV-ITEM-${id}` || 
      i.id === id || 
      i.id.replace('INV-ITEM-', '') === id
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found"
      });
    }

    // Prepare updates
    const updateData = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.unit_label !== undefined) updateData.unit_label = updates.unit_label;
    if (updates.rate !== undefined) updateData.rate = parseFloat(updates.rate);
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.current_stock !== undefined) updateData.current_stock = parseFloat(updates.current_stock);
    if (updates.reorder_level !== undefined) updateData.reorder_level = parseFloat(updates.reorder_level);

    await update("inventory_items", item.id, updateData);

    console.log(`Inventory item ${item.id} updated successfully`);

    res.json({
      success: true,
      message: "Inventory item updated successfully",
      data: {
        id: parseInt(item.id.replace('INV-ITEM-', '')) || parseInt(item.id),
        ...updateData
      }
    });

  } catch (error) {
    console.error("Update inventory item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update inventory item",
      error: error.message
    });
  }
}

/**
 * DELETE /api/inventory/items/:id - Delete inventory item
 */
export async function deleteInventoryItem(req, res) {
  try {
    const { id } = req.params;

    console.log(`Deleting inventory item: ${id}`);

    // Find item
    const items = await getAll("inventory_items");
    const item = items.find(i => 
      i.id === `INV-ITEM-${id}` || 
      i.id === id || 
      i.id.replace('INV-ITEM-', '') === id
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Inventory item not found"
      });
    }

    await remove("inventory_items", item.id);

    console.log(`Inventory item ${item.id} deleted successfully`);

    res.json({
      success: true,
      message: "Inventory item deleted successfully"
    });

  } catch (error) {
    console.error("Delete inventory item error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete inventory item",
      error: error.message
    });
  }
}

/**
 * POST /api/inventory/orders - Place inventory order
 */
export async function placeInventoryOrder(req, res) {
  try {
    const { ordered_by, notes, items: orderItems } = req.body;

    // Validate
    if (!ordered_by || !orderItems || orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ordered_by and items are required"
      });
    }

    const orderId = `INV-ORD-${Date.now()}`;
    console.log(`Creating inventory order: ${orderId} by ${ordered_by}`);

    // Get inventory items to calculate amounts
    const inventoryItems = await getAll("inventory_items");
    let totalAmount = 0;
    const orderLineItems = [];

    for (const orderItem of orderItems) {
      const invItem = inventoryItems.find(i => 
        i.id === `INV-ITEM-${orderItem.inventory_item_id}` ||
        i.id === orderItem.inventory_item_id.toString() ||
        i.id.replace('INV-ITEM-', '') === orderItem.inventory_item_id.toString()
      );

      if (!invItem) {
        return res.status(404).json({
          success: false,
          message: `Inventory item ${orderItem.inventory_item_id} not found`
        });
      }

      const rate = parseFloat(invItem.rate) || 0;
      const quantity = parseFloat(orderItem.quantity) || 0;
      const lineAmount = rate * quantity;
      totalAmount += lineAmount;

      orderLineItems.push({
        id: `INV-ORD-ITEM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        inventory_order_id: orderId,
        inventory_item_id: invItem.id,
        item_name: invItem.name,
        unit: invItem.unit_label,
        rate: rate,
        quantity: quantity,
        line_amount: lineAmount
      });
    }

    // Create order
    const orderData = {
      id: orderId,
      ordered_by,
      total_amount: totalAmount,
      status: 'pending',
      ordered_at: new Date().toISOString(),
      purchased_at: '',
      purchased_by: '',
      notes: notes || ''
    };

    await create("inventory_orders", orderData);
    await bulkCreate("inventory_order_items", orderLineItems);

    console.log(`Inventory order ${orderId} created with ${orderLineItems.length} items`);

    res.status(201).json({
      success: true,
      message: "Inventory order placed successfully",
      data: {
        order_id: parseInt(orderId.replace('INV-ORD-', ''))
      }
    });

  } catch (error) {
    console.error("Place inventory order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to place inventory order",
      error: error.message
    });
  }
}

/**
 * GET /api/inventory/orders - List inventory orders
 * Query params: status (pending | purchased | all), user (filter by ordered_by)
 */
export async function listInventoryOrders(req, res) {
  try {
    const { status = 'all', user } = req.query;
    console.log(`Fetching inventory orders: status=${status}, user=${user}`);

    let orders = await getAll("inventory_orders");
    const orderItems = await getAll("inventory_order_items");

    // Filter by status
    if (status !== 'all') {
      orders = orders.filter(order => order.status === status);
    }

    // Filter by user
    if (user) {
      orders = orders.filter(order => order.ordered_by === user);
    }

    // Combine orders with items
    const ordersWithItems = orders.map(order => {
      const items = orderItems.filter(item => item.inventory_order_id === order.id);

      return {
        id: parseInt(order.id.replace('INV-ORD-', '')) || parseInt(order.id),
        status: order.status,
        total_amount: parseFloat(order.total_amount) || 0,
        ordered_by: order.ordered_by,
        ordered_at: order.ordered_at,
        purchased_at: order.purchased_at || undefined,
        items: items.map(item => ({
          itemName: item.item_name,
          unit: item.unit,
          rate: parseFloat(item.rate) || 0,
          quantity: parseFloat(item.quantity) || 0,
          lineAmount: parseFloat(item.line_amount) || 0
        }))
      };
    });

    // Sort by ordered_at descending (newest first)
    ordersWithItems.sort((a, b) => {
      const dateA = new Date(a.ordered_at || 0).getTime();
      const dateB = new Date(b.ordered_at || 0).getTime();
      return dateB - dateA;
    });

    res.json({
      success: true,
      count: ordersWithItems.length,
      data: ordersWithItems
    });

  } catch (error) {
    console.error("List inventory orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory orders",
      error: error.message
    });
  }
}

/**
 * PUT /api/inventory/orders/:id/purchased - Mark order as purchased
 */
export async function markOrderPurchased(req, res) {
  try {
    const { id } = req.params;
    const { purchased_by } = req.body;

    console.log(`Marking order ${id} as purchased by ${purchased_by}`);

    // Find order
    const orders = await getAll("inventory_orders");
    const order = orders.find(o => 
      o.id === `INV-ORD-${id}` || 
      o.id === id ||
      o.id.replace('INV-ORD-', '') === id
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    if (order.status === 'purchased') {
      return res.status(400).json({
        success: false,
        message: "Order is already marked as purchased"
      });
    }

    // Update order status
    await update("inventory_orders", order.id, {
      status: 'purchased',
      purchased_at: new Date().toISOString(),
      purchased_by: purchased_by || 'system'
    });

    // Update stock levels
    const orderItems = await getAll("inventory_order_items");
    const items = orderItems.filter(item => item.inventory_order_id === order.id);
    
    for (const item of items) {
      const inventoryItems = await getAll("inventory_items");
      const invItem = inventoryItems.find(i => i.id === item.inventory_item_id);
      
      if (invItem) {
        const currentStock = parseFloat(invItem.current_stock) || 0;
        const quantity = parseFloat(item.quantity) || 0;
        await update("inventory_items", invItem.id, {
          current_stock: currentStock + quantity
        });
      }
    }

    console.log(`Order ${order.id} marked as purchased, stock updated`);

    res.json({
      success: true,
      message: "Order marked as purchased successfully"
    });

  } catch (error) {
    console.error("Mark order purchased error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark order as purchased",
      error: error.message
    });
  }
}

/**
 * GET /api/inventory/insights - Get inventory insights
 * Query params: start (ISO date), end (ISO date)
 */
export async function getInventoryInsights(req, res) {
  try {
    const { start, end } = req.query;
    console.log(`Fetching inventory insights: ${start} to ${end}`);

    // Get date range (default to current month)
    const now = new Date();
    const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = end ? new Date(end) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get purchased orders only
    let orders = await getAll("inventory_orders");
    orders = orders.filter(order => {
      if (order.status !== 'purchased' || !order.purchased_at) return false;
      const purchasedDate = new Date(order.purchased_at);
      return purchasedDate >= startDate && purchasedDate <= endDate;
    });

    if (orders.length === 0) {
      return res.json({
        success: true,
        data: {
          total_items_purchased: 0,
          total_quantity_purchased: 0,
          total_amount_spent: 0,
          unique_items: 0,
          average_order_value: 0,
          purchase_count: 0,
          most_purchased_item: null,
          top_spender: null
        }
      });
    }

    // Get all order items for these orders
    const orderItems = await getAll("inventory_order_items");
    const relevantItems = orderItems.filter(item => 
      orders.some(order => order.id === item.inventory_order_id)
    );

    // Calculate metrics
    const totalAmountSpent = orders.reduce((sum, order) => sum + (parseFloat(order.total_amount) || 0), 0);
    const purchaseCount = orders.length;
    const averageOrderValue = purchaseCount > 0 ? totalAmountSpent / purchaseCount : 0;

    // Item-level aggregation
    const itemStats = {};
    let totalQuantityPurchased = 0;

    relevantItems.forEach(item => {
      const name = item.item_name;
      const quantity = parseFloat(item.quantity) || 0;
      const amount = parseFloat(item.line_amount) || 0;

      totalQuantityPurchased += quantity;

      if (!itemStats[name]) {
        itemStats[name] = { quantity: 0, amount: 0 };
      }
      itemStats[name].quantity += quantity;
      itemStats[name].amount += amount;
    });

    const uniqueItems = Object.keys(itemStats).length;
    const totalItemsPurchased = relevantItems.length;

    // Most purchased item
    let mostPurchasedItem = null;
    if (uniqueItems > 0) {
      const sorted = Object.entries(itemStats).sort((a, b) => b[1].quantity - a[1].quantity);
      mostPurchasedItem = {
        name: sorted[0][0],
        quantity: sorted[0][1].quantity,
        amount: sorted[0][1].amount
      };
    }

    // Top spender
    const spenderStats = {};
    orders.forEach(order => {
      const spender = order.ordered_by;
      const amount = parseFloat(order.total_amount) || 0;

      if (!spenderStats[spender]) {
        spenderStats[spender] = { amount: 0, orders: 0 };
      }
      spenderStats[spender].amount += amount;
      spenderStats[spender].orders += 1;
    });

    let topSpender = null;
    if (Object.keys(spenderStats).length > 0) {
      const sortedSpenders = Object.entries(spenderStats).sort((a, b) => b[1].amount - a[1].amount);
      topSpender = {
        name: sortedSpenders[0][0],
        amount: sortedSpenders[0][1].amount,
        orders: sortedSpenders[0][1].orders
      };
    }

    res.json({
      success: true,
      data: {
        total_items_purchased: totalItemsPurchased,
        total_quantity_purchased: totalQuantityPurchased,
        total_amount_spent: totalAmountSpent,
        unique_items: uniqueItems,
        average_order_value: averageOrderValue,
        purchase_count: purchaseCount,
        most_purchased_item: mostPurchasedItem,
        top_spender: topSpender
      }
    });

  } catch (error) {
    console.error("Get inventory insights error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory insights",
      error: error.message
    });
  }
}

/**
 * GET /api/inventory/insights/export - Export inventory insights as CSV
 */
export async function exportInventoryInsights(req, res) {
  try {
    const { start, end } = req.query;
    console.log(`Exporting inventory insights: ${start} to ${end}`);

    // Get date range
    const now = new Date();
    const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = end ? new Date(end) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get purchased orders
    let orders = await getAll("inventory_orders");
    orders = orders.filter(order => {
      if (order.status !== 'purchased' || !order.purchased_at) return false;
      const purchasedDate = new Date(order.purchased_at);
      return purchasedDate >= startDate && purchasedDate <= endDate;
    });

    const orderItems = await getAll("inventory_order_items");

    // Build CSV
    const csvRows = [];
    csvRows.push(['=== INVENTORY EXPENSES REPORT ===']);
    csvRows.push(['Period:', `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`]);
    csvRows.push(['Generated on:', new Date().toISOString()]);
    csvRows.push(['']);
    csvRows.push(['=== PURCHASE ORDERS ===']);
    csvRows.push(['Order ID', 'Ordered By', 'Total Amount', 'Status', 'Ordered Date', 'Purchased Date']);

    orders.forEach(order => {
      csvRows.push([
        order.id,
        order.ordered_by,
        `₹${parseFloat(order.total_amount || 0).toFixed(2)}`,
        order.status,
        order.ordered_at,
        order.purchased_at || ''
      ]);
    });

    csvRows.push(['']);
    csvRows.push(['=== ORDER ITEMS ===']);
    csvRows.push(['Order ID', 'Item Name', 'Unit', 'Rate', 'Quantity', 'Line Amount']);

    orders.forEach(order => {
      const items = orderItems.filter(item => item.inventory_order_id === order.id);
      items.forEach(item => {
        csvRows.push([
          order.id,
          item.item_name,
          item.unit,
          `₹${parseFloat(item.rate || 0).toFixed(2)}`,
          item.quantity,
          `₹${parseFloat(item.line_amount || 0).toFixed(2)}`
        ]);
      });
    });

    // Convert to CSV string
    const csvContent = csvRows.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    // Send as downloadable file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-expenses-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error("Export inventory insights error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export inventory insights",
      error: error.message
    });
  }
}
