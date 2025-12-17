# Stats API Documentation

## Overview
This document describes the statistics endpoints for the cafe management system. All stats are calculated based on orders stored in Google Sheets with proper timezone handling (Asia/Kolkata).

---

## Endpoints

### 1. Revenue Statistics
**GET** `/api/stats/revenue`

Returns daily and monthly revenue for **paid orders only** (where `payment_status = 'paid'`), broken down by payment method.

#### Response Format:
```json
{
  "success": true,
  "data": {
    "daily_revenue": 125.00,           // All paid orders today
    "daily_revenue_cash": 75.00,        // Cash payments today
    "daily_revenue_upi": 50.00,         // UPI payments today
    "monthly_revenue": 1120.00,         // All paid orders this month
    "monthly_revenue_cash": 670.00,     // Cash payments this month
    "monthly_revenue_upi": 450.00       // UPI payments this month
  }
}
```

#### Logic:
- **Daily Revenue**: Sum of `total_amount` for orders where:
  - `created_at` is today (Asia/Kolkata timezone)
  - `payment_status = 'paid'`
  - `order_status != 'cancelled'`

- **Monthly Revenue**: Sum of `total_amount` for orders where:
  - `created_at` is in current month (Asia/Kolkata timezone)
  - `payment_status = 'paid'`
  - `order_status != 'cancelled'`

- **By Payment Method**: Further filtered by `payment_method = 'cash'` or `payment_method = 'upi'`

---

### 2. Dashboard Statistics
**GET** `/api/stats/dashboard`

Returns key metrics for the admin dashboard including pending orders, unpaid orders, completed orders, and fast-moving items.

#### Response Format:
```json
{
  "success": true,
  "data": {
    "pending_orders": 2,
    "unpaid_orders": 5,
    "unpaid_amount": 250.00,
    "completed_orders": 15,
    "fast_moving_items": [
      {
        "item_name": "Masala Tea",
        "total_quantity": 45
      },
      {
        "item_name": "Black Coffee",
        "total_quantity": 32
      }
      // ... up to 20 items
    ]
  }
}
```

#### Logic:

1. **Pending Orders**:
   - Count orders where `order_status = 'pending'`
   - Excludes cancelled orders

2. **Unpaid Orders**:
   - Count orders where `payment_status = 'unpaid'`
   - Excludes cancelled orders

3. **Unpaid Amount**:
   - Sum of `total_amount` for unpaid orders
   - Excludes cancelled orders

4. **Completed Orders**:
   - Count orders where BOTH:
     - `order_status = 'completed'`
     - `payment_status = 'paid'`
   - This is the strictest metric (requires both completion AND payment)

5. **Fast Moving Items**:
   - Top 20 items by quantity sold
   - Aggregates quantities from `order_items` table
   - Only includes items from non-cancelled orders
   - Sorted by total quantity (descending)

---

### 3. Dashboard Export
**GET** `/api/stats/dashboard/export`

Exports comprehensive dashboard data as a CSV file for download.

#### Response:
- Content-Type: `text/csv`
- Filename: `cafe-dashboard-export-YYYY-MM-DD.csv`

#### CSV Contents:
1. **Statistics Summary**:
   - Daily stats (orders today, paid orders, revenue)
   - Monthly stats (total orders, revenue)
   - Order status counts (pending, completed, unpaid)

2. **Detailed Orders Data**:
   - Order ID, Customer Name, Phone, Email
   - Order Date, Order Status, Payment Status, Payment Method
   - Total Amount

---

## Database Schema Reference

### Orders Table Fields:
- `id`: Order ID (e.g., "ORD-1765904001001")
- `customer_name`: Customer's name
- `customer_phone`: Customer's phone number
- `customer_email`: Customer's email
- `total_amount`: Order total (numeric)
- `order_status`: One of: `'pending'`, `'preparing'`, `'ready'`, `'completed'`, `'cancelled'`
- `payment_status`: One of: `'unpaid'`, `'paid'`
- `payment_method`: One of: `'cash'`, `'upi'` (or empty if unpaid)
- `special_instructions`: Optional notes
- `created_at`: ISO timestamp

### Order Items Table Fields:
- `id`: Item ID
- `order_id`: Reference to Orders table
- `menu_item_id`: Reference to Menu Items table
- `item_name`: Name of the item
- `item_price`: Price per item
- `quantity`: Number of items ordered
- `subtotal`: item_price × quantity
- `special_instructions`: Optional item-specific notes

---

## Important Notes

1. **Timezone**: All date calculations use **Asia/Kolkata timezone** to ensure accurate daily/monthly grouping

2. **Payment Status Values**:
   - Database stores: `'paid'` or `'unpaid'` (NOT "paid cash" or "paid upi")
   - Payment method is stored separately in `payment_method` field

3. **Cancelled Orders**:
   - Excluded from all revenue and count calculations
   - Not included in fast-moving items calculation

4. **Completed Orders**:
   - Most strict metric: requires BOTH `order_status = 'completed'` AND `payment_status = 'paid'`
   - An order that is completed but unpaid will NOT count as completed

5. **Frontend Integration**:
   - Frontend already calls these endpoints via `lib/order-api.ts`
   - No UI changes needed - endpoints match existing API calls

---

## Testing

### Test Revenue Endpoint:
```bash
curl http://localhost:3000/api/stats/revenue
```

### Test Dashboard Endpoint:
```bash
curl http://localhost:3000/api/stats/dashboard
```

### Test Export Endpoint:
```bash
curl http://localhost:3000/api/stats/dashboard/export -o dashboard-export.csv
```

---

## Error Handling

All endpoints return error responses in this format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common HTTP status codes:
- `200`: Success
- `500`: Internal server error (database or calculation issues)
