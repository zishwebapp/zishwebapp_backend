# Orders API - Testing Guide

## 🚀 Implementation Complete!

The Orders API has been successfully implemented with full Google Sheets integration.

---

## 📋 Setup & Prerequisites

### 1. Restart Server (if running)
```bash
cd /Users/hammadrahaman/Desktop/ZISH/ZishGoogleAPI/Zishgoogleforms/BackendGoogleForms
npm run dev
```

### 2. Ensure Quarterly Tabs Exist
The quarterly tabs will be automatically created on first API call, but you can test:
```
GET http://localhost:3000/api/test-sheets
```

---

## 🔗 API Endpoints

Base URL: `http://localhost:3000`

### 1. **Place New Order** ✨
**POST** `/api/orders`

**Request Body:**
```json
{
  "customerName": "John Doe",
  "customerPhone": "9876543210",
  "customerEmail": "john@example.com",
  "items": [
    {
      "menuItemId": "1",
      "quantity": 2,
      "specialInstructions": "Extra sugar"
    },
    {
      "menuItemId": "2",
      "quantity": 1
    }
  ],
  "specialInstructions": "Please deliver to gate 2"
}
```

**Required Fields:**
- `customerName` (string)
- `items` (array with at least 1 item)
  - `menuItemId` (string/number)
  - `quantity` (number)

**Optional Fields:**
- `customerPhone` (string)
- `customerEmail` (string)
- `specialInstructions` (string)
- `items[].specialInstructions` (string)

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Order placed successfully",
  "data": {
    "id": "ORD-1733651234567",
    "customerName": "John Doe",
    "totalAmount": "250.00",
    "status": "pending",
    "items": [
      {
        "itemName": "Black Coffee",
        "quantity": 2,
        "price": 100,
        "subtotal": "200.00"
      },
      {
        "itemName": "Sandwich",
        "quantity": 1,
        "price": 50,
        "subtotal": "50.00"
      }
    ],
    "createdAt": "2024-12-08T09:30:00.000Z"
  }
}
```

---

### 2. **Get All Orders**
**GET** `/api/orders`

**Response (200 OK):**
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "id": "ORD-1733651234567",
      "customer_name": "John Doe",
      "customer_phone": "9876543210",
      "customer_email": "john@example.com",
      "total_amount": "250.00",
      "order_status": "pending",
      "payment_status": "unpaid",
      "payment_method": "cash",
      "special_instructions": "Please deliver to gate 2",
      "created_at": "2024-12-08T09:30:00.000Z",
      "items": [
        {
          "itemName": "Black Coffee",
          "quantity": 2,
          "price": 100,
          "subtotal": 200
        }
      ],
      "itemCount": 2
    }
  ]
}
```

---

### 3. **Get Order by ID**
**GET** `/api/orders/:id`

**Example:**
```
GET http://localhost:3000/api/orders/ORD-1733651234567
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "ORD-1733651234567",
    "customer_name": "John Doe",
    "customer_phone": "9876543210",
    "total_amount": "250.00",
    "order_status": "pending",
    "payment_status": "pending",
    "items": [
      {
        "itemName": "Black Coffee",
        "quantity": 2,
        "price": 100,
        "subtotal": 200
      }
    ],
    "statusHistory": [
      {
        "oldStatus": "",
        "newStatus": "pending",
        "changedBy": "system",
        "timestamp": "2024-12-08T09:30:00.000Z"
      }
    ]
  }
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "message": "Order not found"
}
```

---

### 4. **Update Order Status**
**PUT** `/api/orders/:id/status`

**Request Body:**
```json
{
  "status": "confirmed",
  "changedBy": "admin"
}
```

**Valid Status Values:**
- `pending`
- `preparing`
- `ready`
- `completed`
- `cancelled`

**Example:**
```
PUT http://localhost:3000/api/orders/ORD-1733651234567/status
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "orderId": "ORD-1733651234567",
    "oldStatus": "pending",
    "newStatus": "confirmed",
    "changedBy": "admin"
  }
}
```

---

### 5. **Update Payment Status**
**PUT** `/api/orders/:id/payment`

**Request Body:**
```json
{
  "paymentStatus": "paid",
  "paymentMethod": "upi"
}
```

**Valid Payment Status Values:**
- `unpaid`
- `paid`

**Valid Payment Method Values:**
- `cash`
- `card`
- `upi`
- `online`

**Example:**
```
PUT http://localhost:3000/api/orders/ORD-1733651234567/payment
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment status updated successfully",
  "data": {
    "orderId": "ORD-1733651234567",
    "paymentStatus": "paid",
    "paymentMethod": "upi"
  }
}
```

---

### 6. **Get Orders by Customer Phone**
**GET** `/api/orders/customer/:phone`

**Example:**
```
GET http://localhost:3000/api/orders/customer/9876543210
```

**Response (200 OK):**
```json
{
  "success": true,
  "count": 3,
  "customerPhone": "9876543210",
  "data": [
    {
      "id": "ORD-1733651234567",
      "customer_name": "John Doe",
      "customer_phone": "9876543210",
      "total_amount": "250.00",
      "order_status": "delivered",
      "items": [...],
      "itemCount": 2
    }
  ]
}
```

**Response (404 Not Found):**
```json
{
  "success": false,
  "message": "No orders found for this phone number"
}
```

---

## 🧪 Testing Workflow

### Step 1: Place an Order
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test Customer",
    "customerPhone": "1234567890",
    "items": [
      {"menuItemId": "1", "quantity": 2}
    ]
  }'
```

**Copy the `id` from the response for next steps**

---

### Step 2: Get All Orders
```bash
curl http://localhost:3000/api/orders
```

---

### Step 3: Get Specific Order
```bash
curl http://localhost:3000/api/orders/ORD-1733651234567
```
*(Replace with your actual order ID)*

---

### Step 4: Update Order Status
```bash
curl -X PUT http://localhost:3000/api/orders/ORD-1733651234567/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed",
    "changedBy": "admin"
  }'
```

---

### Step 5: Update Payment Status
```bash
curl -X PUT http://localhost:3000/api/orders/ORD-1733651234567/payment \
  -H "Content-Type: application/json" \
  -d '{
    "paymentStatus": "paid",
    "paymentMethod": "upi"
  }'
```

---

### Step 6: Get Customer Orders
```bash
curl http://localhost:3000/api/orders/customer/1234567890
```

---

## 📊 Google Sheets Structure

After placing your first order, check your Google Spreadsheet. You should see these quarterly tabs:

### **Q4_2024_Orders** (or current quarter)
| Order ID | Customer Name | Phone | Email | Total Amount | Order Status | Payment Status | Payment Method | Special Instructions | Order Date |
|----------|--------------|--------|-------|--------------|--------------|----------------|----------------|---------------------|------------|

### **Q4_2024_Order_Items**
| Item ID | Order ID | Menu Item ID | Item Name | Price | Quantity | Subtotal | Special Instructions |
|---------|----------|--------------|-----------|-------|----------|----------|---------------------|

### **Q4_2024_Order_Status_History**
| History ID | Order ID | Old Status | New Status | Changed By | Timestamp |
|-----------|----------|------------|------------|------------|-----------|

---

## ❗ Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Customer name and items are required"
}
```

### 404 Not Found
```json
{
  "success": false,
  "message": "Menu item with ID 999 not found"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Failed to place order",
  "error": "Detailed error message"
}
```

---

## 🎯 Quick Test Commands

### Using Postman or Thunder Client:

1. **Place Order:**
   - Method: POST
   - URL: `http://localhost:3000/api/orders`
   - Body (JSON):
   ```json
   {
     "customerName": "John Doe",
     "customerPhone": "9876543210",
     "items": [
       {"menuItemId": "1", "quantity": 2}
     ]
   }
   ```

2. **Get All Orders:**
   - Method: GET
   - URL: `http://localhost:3000/api/orders`

3. **Update Status:**
   - Method: PUT
   - URL: `http://localhost:3000/api/orders/[ORDER_ID]/status`
   - Body (JSON):
   ```json
   {
     "status": "confirmed",
     "changedBy": "admin"
   }
   ```

---

## ✅ Features Implemented

- ✅ Place new orders with multiple items
- ✅ Automatic total amount calculation
- ✅ Menu item availability validation
- ✅ Order status tracking (pending → confirmed → preparing → ready → delivered)
- ✅ Payment status management
- ✅ Customer order history by phone
- ✅ Order status history audit trail
- ✅ Item-level special instructions
- ✅ Quarterly Google Sheets organization
- ✅ Comprehensive error handling
- ✅ Input validation

---

## 🎉 You're All Set!

Start testing the endpoints and let me know if you encounter any issues!
