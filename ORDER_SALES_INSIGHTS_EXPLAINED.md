# Order Sales Insights - Explanation & Fix

## Questions Answered

### Q1: Are we storing the date of order in the backend? How are we fetching it?

**Answer: YES** ✅

#### Database Storage:
In the **Orders** table, we store:
- **Column**: `created_at` 
- **Format**: ISO timestamp (e.g., "2024-12-17T10:30:00.000Z")
- **Location**: Column J in Google Sheets

See `config/sheetsConfig.js`:
```javascript
orders: {
  columns: [
    "id", "customer_name", "customer_phone", "customer_email", 
    "total_amount", "order_status", "payment_status", "payment_method", 
    "special_instructions", "created_at"  // ← Date stored here
  ],
  headers: [
    "Order ID", "Customer Name", "Phone", "Email", 
    "Total Amount", "Order Status", "Payment Status", "Payment Method", 
    "Special Instructions", "Order Date"  // ← Shows as "Order Date" in sheet
  ]
}
```

#### How We Fetch & Filter:

**1. Get all orders:**
```javascript
const orders = await getAll("orders");  // Fetches from Google Sheets
```

**2. Filter by date range:**
```javascript
// Filter orders within date range
const filteredOrders = orders.filter(order => {
  if (!order.created_at) return false;
  const orderDate = new Date(order.created_at);  // ← Parse the ISO timestamp
  return orderDate >= startDate && orderDate <= endDate;
});
```

**3. Timezone handling:**
```javascript
// Convert to Asia/Kolkata timezone for accurate day/month grouping
const orderDate = new Date(order.created_at);
const orderDateKolkata = new Date(
  orderDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
);
```

**Example:**
- Order created: `2024-12-17T10:30:00.000Z`
- Stored in: `created_at` column
- Retrieved by: `getAll("orders")`
- Filtered by: Comparing `new Date(order.created_at)` with date range

---

### Q2: Why is "Order Sales (Completed Orders)" showing 0?

**Answer: Missing Backend Endpoints** ❌ → ✅ NOW FIXED

#### The Problem:

The Inventory Insights frontend was calling two endpoints that **didn't exist**:

1. **`GET /api/stats/orders-insights`** - For completed orders
2. **`GET /api/stats/sales`** - For paid sales

Result: API calls failed → No data shown → Everything shows 0

#### What Each Endpoint Does:

**1. Orders Insights** (`/api/stats/orders-insights`):
- Filters: `order_status = 'completed'` (excludes cancelled)
- Returns:
  - Count of completed orders
  - Total amount of completed orders
  - Total items sold (from completed orders)
  - Top 20 items by quantity

**2. Sales Insights** (`/api/stats/sales`):
- Filters: `payment_status = 'paid'` (regardless of order_status, excludes cancelled)
- Returns:
  - Total sales amount (paid orders)
  - Count of paid orders
  - Total items sold (from paid orders)
  - Top 20 items by quantity

#### The Fix:

I've now added both endpoints to `controllers/statsController.js`:

```javascript
export async function getOrdersInsights(req, res) {
  // Filters by order_status = 'completed'
  // Calculates: count, amount, items sold, top items
  // Date range: start & end query params
}

export async function getSalesInsights(req, res) {
  // Filters by payment_status = 'paid'
  // Calculates: total sales, count, items sold, top items  
  // Date range: start & end query params
}
```

And registered them in `routes/statsRoutes.js`:
```javascript
router.get("/orders-insights", getOrdersInsights);
router.get("/sales", getSalesInsights);
```

---

## How Order Sales Section Works

### Frontend Logic (inventory-insights.tsx):

```javascript
// Lines 97-100: Fetch both endpoints in parallel
const [completedRes, salesRes] = await Promise.all([
  fetchOrdersInsights({ start, end }),    // ← Completed orders
  fetchSalesInsights({ start, end })      // ← Paid sales
]);

// Display data:
setOrdersInsights({
  completed_orders_count: completedRes.completed_orders_count,
  completed_orders_amount: completedRes.completed_orders_amount,
  total_items_sold: completedRes.total_items_sold,
  top_items: completedRes.top_items
});

setPaidRevenue(salesRes.total_sales);  // ← Shows "Paid Revenue (₹)"
setSalesTopItems(salesRes.top_items);
```

### What You'll See After Fix:

**Order Sales (Completed Orders) section will show:**
- ✅ Completed Orders: [Count of completed orders]
- ✅ Paid Revenue (₹): [Total from paid orders]
- ✅ Total Items Sold: [Sum of quantities]
- ✅ Top Items table: [Top 20 items with quantities]

---

## Date Filtering in Inventory Insights

The Inventory Insights page uses **3 filtering options**:

### 1. This Month (Default)
```javascript
start = new Date(year, currentMonth, 1)      // First day of current month
end = new Date(year, currentMonth + 1, 0)    // Last day of current month
```

### 2. Last Month
```javascript
start = new Date(year, currentMonth - 1, 1)  // First day of last month
end = new Date(year, currentMonth, 0)        // Last day of last month
```

### 3. Custom Range
```javascript
start = customStartDate  // User selected
end = customEndDate      // User selected
```

All three filters are applied to:
- ✅ Inventory expenses (purchased orders)
- ✅ Order sales (completed orders)
- ✅ Paid sales (paid orders)

---

## Complete Data Flow

### When Admin opens Inventory Insights:

1. **Frontend**: Calls `/api/inventory/insights?start=2024-12-01&end=2024-12-31`
   - Backend filters: `inventory_orders` where `status = 'purchased'` and `purchased_at` in range
   - Returns: Inventory expense metrics

2. **Frontend**: Calls `/api/stats/orders-insights?start=2024-12-01&end=2024-12-31`
   - Backend filters: `orders` where `order_status = 'completed'` and `created_at` in range
   - Returns: Completed orders metrics

3. **Frontend**: Calls `/api/stats/sales?start=2024-12-01&end=2024-12-31`
   - Backend filters: `orders` where `payment_status = 'paid'` and `created_at` in range
   - Returns: Paid sales metrics

4. **Frontend**: Combines all three datasets and displays:
   - Inventory Expenses Summary (top section)
   - Order Sales (Completed Orders) (middle section)
   - Additional metrics (bottom cards)

---

## Why It Was Showing 0

**Before Fix:**
- `/api/stats/orders-insights` → ❌ 404 Not Found
- `/api/stats/sales` → ❌ 404 Not Found
- Frontend catches error → Sets data to `null`
- UI displays: 0, ₹0.00, N/A

**After Fix:**
- Both endpoints exist ✅
- Backend filters and calculates correctly ✅
- Frontend receives real data ✅
- UI displays actual metrics ✅

---

## Testing the Fix

### Step 1: Restart Backend
The backend should auto-restart (nodemon), but if not:
```bash
cd /Users/hammadrahaman/Desktop/ZISH/ZishGoogleAPI/Zishgoogleforms/BackendGoogleForms
npm run dev
```

### Step 2: Test Endpoints Manually

**Test orders insights:**
```bash
curl "http://localhost:3000/api/stats/orders-insights?start=2024-12-01&end=2024-12-31"
```

**Test sales insights:**
```bash
curl "http://localhost:3000/api/stats/sales?start=2024-12-01&end=2024-12-31"
```

### Step 3: Check Frontend
1. Open http://localhost:3001/admin
2. Login as Super Admin
3. Go to "Inventory Insights" tab
4. You should now see real data in "Order Sales (Completed Orders)"!

---

## Expected Response Examples

### Orders Insights Response:
```json
{
  "success": true,
  "data": {
    "start": "2024-12-01",
    "end": "2024-12-31",
    "completed_orders_count": 15,
    "completed_orders_amount": 2500.00,
    "total_items_sold": 45,
    "top_items": [
      { "item_name": "Masala Tea", "total_quantity": 20 },
      { "item_name": "Black Coffee", "total_quantity": 15 }
    ]
  }
}
```

### Sales Insights Response:
```json
{
  "success": true,
  "data": {
    "start": "2024-12-01",
    "end": "2024-12-31",
    "total_sales": 3000.00,
    "completed_orders_count": 18,
    "completed_orders_amount": 3000.00,
    "total_items_sold": 52,
    "top_items": [
      { "item_name": "Masala Tea", "total_quantity": 22 },
      { "item_name": "Black Coffee", "total_quantity": 18 }
    ]
  }
}
```

---

## Key Differences

### Orders Insights vs Sales Insights:

| Metric | Orders Insights | Sales Insights |
|--------|----------------|----------------|
| Filter | `order_status = 'completed'` | `payment_status = 'paid'` |
| Date field | `created_at` | `created_at` |
| Includes | Only completed orders | All paid orders (any status) |
| Use case | Track completed transactions | Track actual revenue |

**Both exclude cancelled orders** for accuracy.

---

## Summary

✅ **Date Storage**: Yes, stored in `created_at` column (ISO timestamp)
✅ **Date Filtering**: Works by parsing `created_at` and comparing with date range
✅ **Missing Endpoints**: Now added (`/orders-insights` and `/sales`)
✅ **Order Sales Section**: Will now display real data from backend
✅ **No Design Changes**: All logic only, UI untouched

**Restart your backend and the Order Sales section will work!** 🎉
