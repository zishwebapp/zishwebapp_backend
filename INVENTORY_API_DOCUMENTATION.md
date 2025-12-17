# Inventory System API Documentation

## Overview
Complete inventory management system with 4 connected modules:
1. **Inventory Items** - Master catalog of items
2. **Order Inventory** - Place purchase orders
3. **Required Inventory** - Manage orders (Super Admin)
4. **Inventory Insights** - Analytics dashboard

---

## Modules & Access Control

### 1. Inventory Items Module (Super Admin Only)
**Purpose**: Maintain master catalog of all inventory items

**Access**: Super Admin only

#### GET `/api/inventory/items?status=active`
Get all inventory items with optional status filter.

**Query Parameters:**
- `status` - Filter by status (`active`, `inactive`, `all`). Default: `active`

**Response:**
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "id": 1734567890,
      "name": "Tomatoes",
      "unit_label": "kg",
      "rate": 50.00,
      "category": "Vegetables",
      "status": "active",
      "current_stock": 25.5,
      "reorder_level": 10.0
    }
  ]
}
```

#### POST `/api/inventory/items`
Create new inventory item.

**Request Body:**
```json
{
  "name": "Tomatoes",
  "unit_label": "kg",
  "rate": 50.00,
  "category": "Vegetables",
  "status": "active",
  "created_by": "admin@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Inventory item created successfully",
  "data": {
    "id": 1734567890,
    "name": "Tomatoes",
    "unit_label": "kg",
    "rate": 50.00,
    "category": "Vegetables",
    "status": "active"
  }
}
```

#### PUT `/api/inventory/items/:id`
Update inventory item.

**Request Body** (all fields optional):
```json
{
  "name": "Cherry Tomatoes",
  "rate": 60.00,
  "status": "inactive",
  "current_stock": 30.0,
  "reorder_level": 15.0
}
```

#### DELETE `/api/inventory/items/:id`
Delete inventory item.

**Note**: Only ACTIVE items appear in Order Inventory for admins to purchase.

---

### 2. Order Inventory Module (Admin)
**Purpose**: Admins place inventory purchase orders

**Access**: Admin & Super Admin

#### POST `/api/inventory/orders`
Place a new inventory order.

**Request Body:**
```json
{
  "ordered_by": "admin@example.com",
  "notes": "Urgent - needed for weekend",
  "items": [
    {
      "inventory_item_id": 1734567890,
      "quantity": 10
    },
    {
      "inventory_item_id": 1734567891,
      "quantity": 5
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Inventory order placed successfully",
  "data": {
    "order_id": 1734567892
  }
}
```

**Process:**
1. Admin selects active items and quantities
2. System calculates total amount automatically
3. Order created with status: `pending`
4. Order appears in Required Inventory for Super Admin review

---

### 3. Required Inventory Module (Super Admin Only)
**Purpose**: Review and manage all inventory orders

**Access**: Super Admin only

#### GET `/api/inventory/orders?status=pending`
List all inventory orders with optional filters.

**Query Parameters:**
- `status` - Filter by status (`pending`, `purchased`, `all`). Default: `all`
- `user` - Filter by who ordered (email)

**Response:**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": 1734567892,
      "status": "pending",
      "total_amount": 750.00,
      "ordered_by": "admin@example.com",
      "ordered_at": "2024-12-17T10:30:00.000Z",
      "purchased_at": null,
      "items": [
        {
          "itemName": "Tomatoes",
          "unit": "kg",
          "rate": 50.00,
          "quantity": 10,
          "lineAmount": 500.00
        },
        {
          "itemName": "Onions",
          "unit": "kg",
          "rate": 50.00,
          "quantity": 5,
          "lineAmount": 250.00
        }
      ]
    }
  ]
}
```

#### PUT `/api/inventory/orders/:id/purchased`
Mark order as purchased.

**Request Body:**
```json
{
  "purchased_by": "superadmin@example.com"
}
```

**What Happens:**
1. Order status changed from `pending` → `purchased`
2. Timestamp recorded in `purchased_at`
3. **Stock levels automatically updated** (quantity added to `current_stock`)
4. Order now feeds into Inventory Insights

**Status Meanings:**
- **Pending**: Order placed but not yet purchased (contributes to Pending metrics)
- **Purchased**: Order complete, money spent (contributes to Purchased metrics & Insights)

---

### 4. Inventory Insights Module (Super Admin Only)
**Purpose**: Analytics for purchased inventory

**Access**: Super Admin only

#### GET `/api/inventory/insights?start=2024-12-01&end=2024-12-31`
Get inventory analytics for a date range.

**Query Parameters:**
- `start` - Start date (ISO format). Default: Start of current month
- `end` - End date (ISO format). Default: End of current month

**Response:**
```json
{
  "success": true,
  "data": {
    "total_items_purchased": 25,
    "total_quantity_purchased": 150.5,
    "total_amount_spent": 7500.00,
    "unique_items": 8,
    "average_order_value": 1250.00,
    "purchase_count": 6,
    "most_purchased_item": {
      "name": "Tomatoes",
      "quantity": 50,
      "amount": 2500.00
    },
    "top_spender": {
      "name": "admin@example.com",
      "amount": 5000.00,
      "orders": 4
    }
  }
}
```

**Metrics Explanation:**
- **total_items_purchased**: Total number of line items purchased
- **total_quantity_purchased**: Sum of all quantities
- **total_amount_spent**: Total money spent (₹)
- **unique_items**: Number of different items purchased
- **average_order_value**: Average amount per purchase order
- **purchase_count**: Number of purchase orders completed
- **most_purchased_item**: Item with highest quantity ordered
- **top_spender**: Admin who spent the most

**Critical Rule**: Only shows data from orders marked as "Purchased"

#### GET `/api/inventory/insights/export?start=2024-12-01&end=2024-12-31`
Export insights as CSV file.

**Returns**: CSV file download

---

## Database Schema

### Inventory_Items Table:
```
| Field          | Type   | Description                    |
|----------------|--------|--------------------------------|
| id             | String | INV-ITEM-{timestamp}           |
| name           | String | Item name (e.g., "Tomatoes")   |
| unit_label     | String | Unit (kg, piece, box, etc.)    |
| rate           | Number | Price per unit (₹)             |
| category       | String | Category (Vegetables, etc.)    |
| status         | String | active | inactive                |
| current_stock  | Number | Current quantity on hand       |
| reorder_level  | Number | Minimum stock threshold        |
| created_by     | String | Who created the item           |
| created_at     | String | ISO timestamp                  |
```

### Inventory_Orders Table:
```
| Field          | Type   | Description                    |
|----------------|--------|--------------------------------|
| id             | String | INV-ORD-{timestamp}            |
| ordered_by     | String | Email of who placed order      |
| total_amount   | Number | Total order cost (₹)           |
| status         | String | pending | purchased            |
| ordered_at     | String | When order was placed          |
| purchased_at   | String | When marked as purchased       |
| purchased_by   | String | Who marked it purchased        |
| notes          | String | Optional order notes           |
```

### Inventory_Order_Items Table:
```
| Field               | Type   | Description                  |
|---------------------|--------|------------------------------|
| id                  | String | INV-ORD-ITEM-{timestamp}-{random} |
| inventory_order_id  | String | Reference to order           |
| inventory_item_id   | String | Reference to inventory item  |
| item_name           | String | Item name (snapshot)         |
| unit                | String | Unit label (snapshot)        |
| rate                | Number | Rate at time of order        |
| quantity            | Number | Quantity ordered             |
| line_amount         | Number | rate × quantity              |
```

---

## Business Rules

### Access Control:
1. **Super Admin**:
   - ✅ Full access to all modules
   - ✅ Can create/edit/delete inventory items
   - ✅ Can view and manage all orders
   - ✅ Can mark orders as purchased
   - ✅ Can view analytics

2. **Admin**:
   - ✅ Can view active inventory items
   - ✅ Can place orders
   - ❌ Cannot edit/delete orders after submission
   - ❌ Cannot access insights

### Status Flow:
```
1. Admin places order → Status: PENDING
                       ↓
2. Super Admin reviews → Can edit/delete
                       ↓
3. Super Admin marks purchased → Status: PURCHASED
                               ↓
4. Stock levels updated → Feeds into Insights
```

### Key Rules:
1. **Inactive items** = Hidden from Order Inventory (prevents duplicate/unused items)
2. **Multiple admins** = Can order the same item (no restrictions)
3. **Stock tracking** = Automatically updates when order marked as "Purchased"
4. **Order history** = All orders preserved, filtered by date in Insights
5. **Analytics integrity** = Only "Purchased" orders count in Insights

---

## Testing Commands

### Create Inventory Item:
```bash
curl -X POST http://localhost:3000/api/inventory/items \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Tomatoes",
    "unit_label": "kg",
    "rate": 50.00,
    "category": "Vegetables",
    "status": "active",
    "created_by": "admin@example.com"
  }'
```

### Place Order:
```bash
curl -X POST http://localhost:3000/api/inventory/orders \
  -H "Content-Type: application/json" \
  -d '{
    "ordered_by": "admin@example.com",
    "notes": "Weekly stock",
    "items": [
      {"inventory_item_id": 1734567890, "quantity": 10}
    ]
  }'
```

### Mark as Purchased:
```bash
curl -X PUT http://localhost:3000/api/inventory/orders/1734567892/purchased \
  -H "Content-Type: application/json" \
  -d '{"purchased_by": "superadmin@example.com"}'
```

### Get Insights:
```bash
curl "http://localhost:3000/api/inventory/insights?start=2024-12-01&end=2024-12-31"
```

---

## Error Handling

All endpoints return errors in this format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

**Common HTTP Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad request (missing fields, validation error)
- `404` - Not found
- `500` - Internal server error

---

## Frontend Integration

**No UI changes needed** - Frontend already has:
- Inventory Items management (cards/table view)
- Order Inventory (shopping cart interface)
- Required Inventory (order management table)
- Inventory Insights (analytics dashboard with charts)

All endpoints match frontend expectations exactly!

---

## System Workflow

```
SUPER ADMIN:
1. Add items to catalog (Inventory Items)
   - Set name, unit, rate, category
   - Mark as "active"
                       ↓
ADMIN:
2. View active items (Order Inventory)
3. Add items to cart
4. Place order (status: pending)
                       ↓
SUPER ADMIN:
5. View pending orders (Required Inventory)
6. Review order details
7. Mark as "Purchased"
   - Status: pending → purchased
   - Stock levels updated automatically
                       ↓
SYSTEM:
8. Data feeds into Inventory Insights
9. Analytics available for date ranges
10. Full order history maintained
```

---

## Notes

- Quarterly tabs automatically created (Q1_2025_Inventory_Items, etc.)
- Timezone: Asia/Kolkata for all date calculations
- Stock management: Automatic on purchase
- Order editing: Super Admin only (for now - can be enhanced)
- Notifications: Can be added later

**System is now complete and ready for use!** 🚀
