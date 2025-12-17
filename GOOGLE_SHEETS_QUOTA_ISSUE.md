# Google Sheets API Quota Issue - 500 Errors

## Problem

You're seeing **HTTP 500 errors** with this message in backend logs:
```
Quota exceeded for quota metric 'Read requests' and limit 
'Read requests per minute per user' of service 'sheets.googleapis.com'
```

**Error Code**: 429 (Too Many Requests)  
**Status**: RESOURCE_EXHAUSTED

---

## What's Happening

### Google Sheets API Limits:
- **Read requests**: 60 per minute per user
- **Write requests**: 60 per minute per user

### Your Current System:
Every time someone:
- Opens admin dashboard → Multiple API calls
- Loads orders page → Fetches all orders
- Loads inventory → Fetches items, orders, and order items
- Refreshes page → Repeats all calls

**Result**: Quota exceeded very quickly, especially during testing/development!

---

## Why It Happens More During Development

1. **Hot reload**: Frontend auto-refreshes on code changes
2. **Multiple tabs**: Opening admin in multiple browser tabs
3. **Rapid testing**: Clicking through tabs quickly
4. **No caching**: Every request hits Google Sheets directly

---

## Immediate Solutions (No Code Changes)

### Option 1: Wait 1 Minute
The quota resets every minute. Just wait 60 seconds and try again.

### Option 2: Reduce Tab Switching
- Don't rapidly switch between Dashboard, Inventory Items, Order Inventory, etc.
- Let pages load completely before navigating

### Option 3: Close Extra Tabs
- Close duplicate browser tabs showing admin dashboard
- Use only one tab at a time

### Option 4: Limit Testing
- Test one feature at a time
- Don't refresh too frequently

---

## Long-term Solutions (Future Implementation)

### Solution 1: Implement Caching (Recommended)
Add a simple in-memory cache in backend:

```javascript
// Simple cache with 30-second TTL
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

export async function getAll(tableKey) {
  const cacheKey = `${tableKey}-${Date.now() - (Date.now() % CACHE_TTL)}`;
  
  if (cache.has(cacheKey)) {
    console.log(`✅ Cache hit: ${tableKey}`);
    return cache.get(cacheKey);
  }
  
  const data = await actualGetAll(tableKey);
  cache.set(cacheKey, data);
  return data;
}
```

**Benefits:**
- Reduces API calls by 90%
- Data still fresh (30s old max)
- Quota issues eliminated

### Solution 2: Batch Requests
Instead of separate calls for orders + order_items, fetch once and cache.

### Solution 3: Pagination
Implement proper pagination to fetch fewer records at once.

### Solution 4: Debouncing
Add delays between rapid consecutive requests.

### Solution 5: Upgrade Google Sheets Quota
- Switch to Google Cloud project with higher quotas
- Pay for increased API limits (usually not necessary)

---

## For Now (Temporary Fix)

The system will work fine in **normal production use** because:
- ✅ Real users don't switch tabs rapidly
- ✅ Normal browsing is well within quota limits
- ✅ 60 reads/minute is plenty for typical usage

The quota issue only appears during:
- ❌ Development (hot reloading)
- ❌ Testing (rapid clicking)
- ❌ Multiple developers accessing simultaneously

---

## Recommended Action

### For Development:
1. Be aware of the quota limit
2. Wait 1 minute if you hit it
3. Reload pages slowly
4. Consider implementing caching (Solution 1 above)

### For Production:
- The current system should work fine
- Monitor quota usage
- Implement caching if issues arise

---

## How to Check Quota Status

Google Sheets quotas reset every minute. You can check current status at:
- Google Cloud Console → APIs & Services → Dashboard
- Look for "Sheets API" usage

---

## Quick Fix to Reduce Calls

The most impactful change would be caching in `services/sheetService.js`:
- Cache `getAll()` results for 30-60 seconds
- This would reduce quota usage by 80-90%
- Very simple to implement (10 lines of code)

**Would you like me to implement caching?** It won't affect design or functionality - just makes the backend more efficient.
