import { getAll } from "../services/sheetService.js";
import { resolveDateRange, isWithinRange } from "../services/dateRange.js";

/**
 * GET /api/stats/revenue - Get revenue statistics (paid orders only)
 * Returns daily and monthly revenue for paid orders
 */
export async function getRevenueStats(req, res) {
  try {
    console.log("Fetching revenue statistics...");

    // Get all orders
    const orders = await getAll("orders");
    
    // Get today's date (start of day in Asia/Kolkata timezone)
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    today.setHours(0, 0, 0, 0);
    
    // Get current month/year in Asia/Kolkata timezone
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Filter paid orders for today (exclude cancelled)
    const paidOrdersToday = orders.filter(order => {
      if (!order.created_at || order.order_status === 'cancelled') return false;
      
      const orderDate = new Date(order.created_at);
      const orderDateKolkata = new Date(orderDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      orderDateKolkata.setHours(0, 0, 0, 0);
      
      // Must be paid (payment_status = 'paid')
      return orderDateKolkata.getTime() === today.getTime() && 
             order.payment_status === 'paid';
    });
    
    // Calculate daily revenue (all paid orders today)
    const dailyRevenue = paidOrdersToday.reduce((sum, order) => {
      return sum + (Number(order.total_amount) || 0);
    }, 0);
    
    // Calculate daily revenue by payment method
    const dailyRevenueCash = paidOrdersToday
      .filter(order => order.payment_method === 'cash')
      .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
      
    const dailyRevenueUPI = paidOrdersToday
      .filter(order => order.payment_method === 'upi')
      .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
    
    // Filter paid orders for current month (exclude cancelled)
    const paidOrdersThisMonth = orders.filter(order => {
      if (!order.created_at || order.order_status === 'cancelled') return false;
      
      const orderDate = new Date(order.created_at);
      const orderDateKolkata = new Date(orderDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      return orderDateKolkata.getMonth() === currentMonth &&
             orderDateKolkata.getFullYear() === currentYear &&
             order.payment_status === 'paid';
    });
    
    // Calculate monthly revenue (all paid orders this month)
    const monthlyRevenue = paidOrdersThisMonth.reduce((sum, order) => {
      return sum + (Number(order.total_amount) || 0);
    }, 0);
    
    // Calculate monthly revenue by payment method
    const monthlyRevenueCash = paidOrdersThisMonth
      .filter(order => order.payment_method === 'cash')
      .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
      
    const monthlyRevenueUPI = paidOrdersThisMonth
      .filter(order => order.payment_method === 'upi')
      .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

    res.json({
      success: true,
      data: {
        daily_revenue: dailyRevenue,
        daily_revenue_cash: dailyRevenueCash,
        daily_revenue_upi: dailyRevenueUPI,
        monthly_revenue: monthlyRevenue,
        monthly_revenue_cash: monthlyRevenueCash,
        monthly_revenue_upi: monthlyRevenueUPI
      }
    });

  } catch (error) {
    console.error("Get revenue stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch revenue statistics",
      error: error.message
    });
  }
}

/**
 * GET /api/stats/dashboard - Get dashboard statistics
 * Returns pending orders, unpaid orders/amount, completed orders, fast-moving items
 */
export async function getDashboardStats(req, res) {
  try {
    console.log("Fetching dashboard statistics...");

    const { range, start, end } = req.query;
    const { startDate, endDate } = resolveDateRange(range, start, end);

    // Get all orders and order items
    const orders = await getAll("orders");
    const orderItems = await getAll("order_items");
    
    // Pending Orders - orders with order_status = 'pending' (exclude cancelled)
    const pendingOrders = orders.filter(order => 
      order.order_status === 'pending' && order.order_status !== 'cancelled'
    ).length;
    
    // Unpaid Orders - orders with payment_status = 'unpaid' (exclude cancelled)
    const unpaidOrdersList = orders.filter(order => 
      order.payment_status === 'unpaid' && order.order_status !== 'cancelled'
    );
    
    const unpaidOrders = unpaidOrdersList.length;
    
    // Unpaid Amount - sum of total_amount for unpaid orders
    const unpaidAmount = unpaidOrdersList.reduce((sum, order) => {
      return sum + (Number(order.total_amount) || 0);
    }, 0);
    
    // Completed Orders - orders with order_status = 'completed' AND payment_status = 'paid'
    const completedOrders = orders.filter(order => 
      order.order_status === 'completed' && order.payment_status === 'paid'
    ).length;
    
    // Fast Moving Items - top 20 items by quantity sold within the selected date range (exclude cancelled orders)
    const validOrderIds = new Set(
      orders
        .filter(order =>
          order.order_status !== 'cancelled' &&
          isWithinRange(order.created_at, startDate, endDate)
        )
        .map(order => order.id)
    );
    
    // Count quantity by item name
    const itemQuantities = {};
    orderItems.forEach(item => {
      // Only count items from non-cancelled orders
      if (!validOrderIds.has(item.order_id)) return;
      
      const itemName = item.item_name;
      const quantity = Number(item.quantity) || 0;
      
      if (!itemQuantities[itemName]) {
        itemQuantities[itemName] = 0;
      }
      itemQuantities[itemName] += quantity;
    });
    
    // Convert to array and sort by quantity (descending)
    const fastMovingItems = Object.entries(itemQuantities)
      .map(([item_name, total_quantity]) => ({
        item_name,
        total_quantity
      }))
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .slice(0, 20); // Top 20 items

    res.json({
      success: true,
      data: {
        pending_orders: pendingOrders,
        unpaid_orders: unpaidOrders,
        unpaid_amount: unpaidAmount,
        completed_orders: completedOrders,
        fast_moving_items: fastMovingItems
      }
    });

  } catch (error) {
    console.error("Get dashboard stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
      error: error.message
    });
  }
}

/**
 * GET /api/stats/orders-insights - Get completed orders insights
 * Returns insights for orders with order_status = 'completed'
 */
export async function getOrdersInsights(req, res) {
  try {
    const { start, end } = req.query;
    console.log(`Fetching orders insights: ${start} to ${end}`);

    // Get all orders and order items
    const orders = await getAll("orders");
    const orderItems = await getAll("order_items");

    // Get date range (default to current month)
    const now = new Date();
    const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = end ? new Date(end) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Filter completed orders within date range (exclude cancelled)
    const completedOrders = orders.filter(order => {
      if (!order.created_at || order.order_status !== 'completed') return false;
      const orderDate = new Date(order.created_at);
      return orderDate >= startDate && orderDate <= endDate;
    });

    // Calculate metrics
    const completedOrdersCount = completedOrders.length;
    const completedOrdersAmount = completedOrders.reduce((sum, order) => {
      return sum + (Number(order.total_amount) || 0);
    }, 0);

    // Get items from completed orders only
    const completedOrderIds = new Set(completedOrders.map(order => order.id));
    const completedOrderItems = orderItems.filter(item => completedOrderIds.has(item.order_id));

    // Count total items sold
    const totalItemsSold = completedOrderItems.reduce((sum, item) => {
      return sum + (Number(item.quantity) || 0);
    }, 0);

    // Top items by quantity
    const itemQuantities = {};
    completedOrderItems.forEach(item => {
      const itemName = item.item_name;
      const quantity = Number(item.quantity) || 0;
      
      if (!itemQuantities[itemName]) {
        itemQuantities[itemName] = 0;
      }
      itemQuantities[itemName] += quantity;
    });

    const topItems = Object.entries(itemQuantities)
      .map(([item_name, total_quantity]) => ({
        item_name,
        total_quantity
      }))
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .slice(0, 20); // Top 20 items

    res.json({
      success: true,
      data: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        completed_orders_count: completedOrdersCount,
        completed_orders_amount: completedOrdersAmount,
        total_items_sold: totalItemsSold,
        top_items: topItems
      }
    });

  } catch (error) {
    console.error("Get orders insights error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders insights",
      error: error.message
    });
  }
}

/**
 * GET /api/stats/sales - Get paid sales insights
 * Returns insights for orders with payment_status = 'paid' (regardless of order_status)
 */
export async function getSalesInsights(req, res) {
  try {
    const { start, end } = req.query;
    console.log(`Fetching sales insights: ${start} to ${end}`);

    // Get all orders and order items
    const orders = await getAll("orders");
    const orderItems = await getAll("order_items");

    // Get date range (default to current month)
    const now = new Date();
    const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = end ? new Date(end) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Filter paid orders within date range (exclude cancelled)
    const paidOrders = orders.filter(order => {
      if (!order.created_at || order.payment_status !== 'paid' || order.order_status === 'cancelled') return false;
      const orderDate = new Date(order.created_at);
      return orderDate >= startDate && orderDate <= endDate;
    });

    // Calculate total sales (paid orders only)
    const totalSales = paidOrders.reduce((sum, order) => {
      return sum + (Number(order.total_amount) || 0);
    }, 0);

    // Get items from paid orders only
    const paidOrderIds = new Set(paidOrders.map(order => order.id));
    const paidOrderItems = orderItems.filter(item => paidOrderIds.has(item.order_id));

    // Count total items sold (from paid orders)
    const totalItemsSold = paidOrderItems.reduce((sum, item) => {
      return sum + (Number(item.quantity) || 0);
    }, 0);

    // Top items by quantity (from paid orders)
    const itemQuantities = {};
    paidOrderItems.forEach(item => {
      const itemName = item.item_name;
      const quantity = Number(item.quantity) || 0;
      
      if (!itemQuantities[itemName]) {
        itemQuantities[itemName] = 0;
      }
      itemQuantities[itemName] += quantity;
    });

    const topItems = Object.entries(itemQuantities)
      .map(([item_name, total_quantity]) => ({
        item_name,
        total_quantity
      }))
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .slice(0, 20); // Top 20 items

    res.json({
      success: true,
      data: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        total_sales: totalSales,
        completed_orders_count: paidOrders.length,
        completed_orders_amount: totalSales,
        total_items_sold: totalItemsSold,
        top_items: topItems
      }
    });

  } catch (error) {
    console.error("Get sales insights error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sales insights",
      error: error.message
    });
  }
}

/**
 * GET /api/stats/dashboard/export - Export dashboard data as CSV
 */
export async function exportDashboardData(req, res) {
  try {
    console.log("Exporting dashboard data...");

    // Get all orders and order items
    const orders = await getAll("orders");
    const orderItems = await getAll("order_items");
    
    // Get today's date in Asia/Kolkata timezone
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    today.setHours(0, 0, 0, 0);
    
    // Get current month/year
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Calculate all metrics
    const ordersToday = orders.filter(order => {
      if (!order.created_at || order.order_status === 'cancelled') return false;
      const orderDate = new Date(order.created_at);
      const orderDateKolkata = new Date(orderDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      orderDateKolkata.setHours(0, 0, 0, 0);
      return orderDateKolkata.getTime() === today.getTime();
    });
    
    const paidOrdersToday = ordersToday.filter(order => order.payment_status === 'paid');
    const dailyRevenue = paidOrdersToday.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
    
    const paidOrdersThisMonth = orders.filter(order => {
      if (!order.created_at || order.order_status === 'cancelled') return false;
      const orderDate = new Date(order.created_at);
      const orderDateKolkata = new Date(orderDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      return orderDateKolkata.getMonth() === currentMonth &&
             orderDateKolkata.getFullYear() === currentYear &&
             order.payment_status === 'paid';
    });
    
    const monthlyRevenue = paidOrdersThisMonth.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
    
    const pendingOrders = orders.filter(order => order.order_status === 'pending' && order.order_status !== 'cancelled').length;
    const completedOrders = orders.filter(order => order.order_status === 'completed' && order.payment_status === 'paid').length;
    const unpaidOrdersList = orders.filter(order => order.payment_status === 'unpaid' && order.order_status !== 'cancelled');
    const unpaidAmount = unpaidOrdersList.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
    
    // Build CSV content
    const csvRows = [];
    csvRows.push(['=== CAFE STATISTICS REPORT ===']);
    csvRows.push(['Generated on:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })]);
    csvRows.push(['']);
    csvRows.push(['DAILY STATS']);
    csvRows.push(['Total Orders Today:', ordersToday.length]);
    csvRows.push(['Paid Orders Today:', paidOrdersToday.length]);
    csvRows.push(['Daily Revenue (Paid Only):', `₹${dailyRevenue.toFixed(2)}`]);
    csvRows.push(['']);
    csvRows.push(['MONTHLY STATS']);
    csvRows.push(['Total Monthly Orders:', paidOrdersThisMonth.length]);
    csvRows.push(['Monthly Revenue (Paid Only):', `₹${monthlyRevenue.toFixed(2)}`]);
    csvRows.push(['']);
    csvRows.push(['ORDER STATUS']);
    csvRows.push(['Pending Orders:', pendingOrders]);
    csvRows.push(['Completed Orders:', completedOrders]);
    csvRows.push(['Unpaid Orders:', unpaidOrdersList.length]);
    csvRows.push(['Unpaid Amount:', `₹${unpaidAmount.toFixed(2)}`]);
    csvRows.push(['']);
    csvRows.push(['=== DETAILED ORDERS DATA ===']);
    csvRows.push(['Order ID', 'Customer Name', 'Phone', 'Email', 'Date', 'Order Status', 'Payment Status', 'Payment Method', 'Total Amount']);
    
    orders.forEach(order => {
      csvRows.push([
        order.id || '',
        order.customer_name || '',
        order.customer_phone || '',
        order.customer_email || '',
        order.created_at || '',
        order.order_status || '',
        order.payment_status || '',
        order.payment_method || '',
        `₹${order.total_amount || '0'}`
      ]);
    });
    
    // Convert to CSV string
    const csvContent = csvRows.map(row => 
      row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    // Send as downloadable file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="cafe-dashboard-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);

  } catch (error) {
    console.error("Export dashboard data error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export dashboard data",
      error: error.message
    });
  }
}
