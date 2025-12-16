# Fix Google Sheets Column Headers

## 🔍 Problem Identified

Your Google Sheets tabs have **mismatched column headers**. The data is being written correctly, but the header row doesn't match the actual column structure.

### Current Issues:

**Q4_2025_Order_Items:**
- Column D header says "Quantity" but contains "Item Name" data
- Missing headers for later columns

**Q4_2025_Order_Status_History:**
- Column C header says "Status" but contains "Old Status" data
- Column D header says "Timestamp" but contains "New Status" data
- Timestamps are in column F, not D

---

## ✅ Solution: Fix Headers Endpoint

I've created a new API endpoint that will update all your quarterly tab headers to match the correct data structure.

### 🚀 How to Fix:

**Step 1: Call the Fix Headers Endpoint**

```bash
GET http://localhost:3000/api/fix-sheet-headers
```

**Using curl:**
```bash
curl http://localhost:3000/api/fix-sheet-headers
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Headers updated successfully",
  "updatedTabs": [
    "Q4_2025_Users",
    "Q4_2025_Menu_Items",
    "Q4_2025_Orders",
    "Q4_2025_Order_Items",
    "Q4_2025_Order_Status_History",
    "Q4_2025_Feedback",
    ...
  ],
  "note": "All existing quarterly tabs now have correct column headers matching the data structure"
}
```

**Step 2: Verify in Google Sheets**

After running the endpoint, check your Google Sheets. The headers should now be:

---

## 📊 Correct Column Structure

### **Q4_2025_Order_Items**
| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Item ID | Order ID | Menu Item ID | **Item Name** | Price | Quantity | Subtotal | Special Instructions |

**Example Data:**
| Item ID | Order ID | Menu Item ID | Item Name | Price | Quantity | Subtotal | Special Instructions |
|---------|----------|--------------|-----------|-------|----------|----------|---------------------|
| OI-123 | ORD-456 | 136 | Normal Tea (Large) | 25 | 2 | 50 | |

---

### **Q4_2025_Order_Status_History**
| A | B | C | D | E | F |
|---|---|---|---|---|---|
| History ID | Order ID | **Old Status** | **New Status** | **Changed By** | **Timestamp** |

**Example Data:**
| History ID | Order ID | Old Status | New Status | Changed By | Timestamp |
|-----------|----------|------------|------------|------------|-----------|
| OSH-123 | ORD-456 | | pending | system | 2025-12-16T09:18:12.954Z |
| OSH-124 | ORD-456 | pending | confirmed | admin | 2025-12-16T09:20:18.395Z |
| OSH-125 | ORD-789 | | pending | system | 2025-12-16T09:27:11.847Z |
| OSH-126 | ORD-789 | pending | ready | admin | 2025-12-16T09:27:48.821Z |

---

### **Q4_2025_Orders**
| A | B | C | D | E | F | G | H | I | J |
|---|---|---|---|---|---|---|---|---|---|
| Order ID | Customer Name | Phone | Email | Total Amount | Order Status | Payment Status | Payment Method | Special Instructions | Order Date |

---

### **Q4_2025_Menu_Items**
| A | B | C | D | E |
|---|---|---|---|---|
| Item ID | Item Name | Price | Category | Availability Status |

---

## 🔧 What the Fix Does

The `/api/fix-sheet-headers` endpoint:

1. ✅ Reads the correct column structure from `sheetsConfig.js`
2. ✅ Updates the header row (Row 1) in each quarterly tab
3. ✅ Does **NOT** modify any data rows (keeps all your existing data intact)
4. ✅ Works on all tabs in the current quarter

---

## 📝 Important Notes

### ⚠️ Your Data is Safe
- The fix **only updates Row 1** (headers)
- All data in rows 2+ remains unchanged
- The data was written correctly; only headers were wrong

### ✅ After Fixing
- Your existing orders will display correctly
- New orders will align with headers
- Status history will show in correct columns

---

## 🧪 Test After Fix

### 1. Check Headers Visually
Open your Google Sheet and verify the header row matches the tables above.

### 2. Place a New Order
```bash
POST http://localhost:3000/api/orders
{
  "customerName": "Test User",
  "customerPhone": "1234567890",
  "items": [
    {"menuItemId": "136", "quantity": 1}
  ]
}
```

### 3. Verify Data Alignment
Check that the new order data appears under the correct column headers.

---

## 🆘 If Something Goes Wrong

### Option 1: Re-run the Fix
Just call `/api/fix-sheet-headers` again. It's safe to run multiple times.

### Option 2: Manual Fix
If needed, you can manually update the header row in Google Sheets:

**For Q4_2025_Order_Items (Row 1):**
```
A1: Item ID
B1: Order ID
C1: Menu Item ID
D1: Item Name
E1: Price
F1: Quantity
G1: Subtotal
H1: Special Instructions
```

**For Q4_2025_Order_Status_History (Row 1):**
```
A1: History ID
B1: Order ID
C1: Old Status
D1: New Status
E1: Changed By
F1: Timestamp
```

---

## ✨ Ready to Fix!

Run this command now:
```bash
curl http://localhost:3000/api/fix-sheet-headers
```

Or open in browser:
```
http://localhost:3000/api/fix-sheet-headers
```

Your sheet headers will be corrected immediately! 🎉
