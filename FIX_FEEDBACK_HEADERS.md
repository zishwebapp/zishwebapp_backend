# Fix Feedback Sheet Headers

## Problem

The Google Sheet has **old headers** that don't match the data being written:

### Current Headers (Wrong):
| Feedback ID | Order ID | Rating | Comment | Submission Date |

### Data Being Written (Correct):
| id | customer_name | email | rating | feedback | created_at |

This causes data to appear in wrong columns!

---

## Solution

Run the fix-headers endpoint to update all sheet headers to match the backend configuration.

### Step 1: Make sure backend is running

```bash
cd /Users/hammadrahaman/Desktop/ZISH/ZishGoogleAPI/Zishgoogleforms/BackendGoogleForms
npm run dev
```

### Step 2: Run the fix command

Open a new terminal and run:

```bash
curl http://localhost:3000/api/fix-sheet-headers
```

This will update **all quarterly sheet headers** including Feedback to:

| Feedback ID | Customer Name | Email | Rating | Feedback | Submission Date |

---

## After Fix

The response will show:
```json
{
  "success": true,
  "message": "Headers updated successfully",
  "updatedTabs": [
    {
      "tab": "Q4_2025_Feedback",
      "table": "feedback",
      "headers": ["Feedback ID", "Customer Name", "Email", "Rating", "Feedback", "Submission Date"]
    }
    // ... other tables
  ]
}
```

---

## Verify

1. Go back to Google Sheets
2. Refresh the Feedback tab
3. You should now see correct headers:
   - Column A: Feedback ID
   - Column B: Customer Name
   - Column C: Email
   - Column D: Rating
   - Column E: Feedback
   - Column F: Submission Date

---

## About Existing Data

The existing data (Hammad, Test@email.com, 5, Awesome) is already in the **correct columns** - it was just that the **headers were wrong**.

After fixing headers, the data will appear under the correct column names!

---

## Quick Fix Command

Just run this one command:
```bash
curl http://localhost:3000/api/fix-sheet-headers
```

Done! ✅
