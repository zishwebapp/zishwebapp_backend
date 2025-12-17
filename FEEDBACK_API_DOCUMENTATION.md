# Feedback API Documentation

## Overview
This document describes the feedback endpoints for the cafe management system. All feedback is stored in Google Sheets with proper timezone handling (Asia/Kolkata).

---

## Endpoints

### 1. Submit Feedback
**POST** `/api/feedback`

Allows customers to submit feedback about their experience.

#### Request Body:
```json
{
  "customerName": "John Doe",      // Optional, defaults to "Anonymous"
  "email": "john@example.com",     // Optional
  "rating": 5,                     // Required (1-5)
  "feedback": "Great service!"     // Optional
}
```

#### Response Format:
```json
{
  "success": true,
  "message": "Feedback submitted successfully",
  "data": {
    "id": 1734567890,
    "customer_name": "John Doe",
    "email": "john@example.com",
    "rating": 5,
    "feedback": "Great service!",
    "timestamp": "2024-12-17T10:30:00.000Z",
    "date": "2024-12-17",
    "created_at": "2024-12-17T10:30:00.000Z",
    "updated_at": "2024-12-17T10:30:00.000Z"
  }
}
```

#### Validation:
- `rating` is required and must be between 1 and 5
- If `customerName` is not provided, defaults to "Anonymous"
- If `email` is not provided, stored as empty string
- If `feedback` is not provided, stored as empty string

---

### 2. Get All Feedback
**GET** `/api/feedback`

Returns all feedback with optional filtering and sorting.

#### Query Parameters:
- `rating` (optional) - Filter by rating (1-5)
- `search` (optional) - Search in customer name, email, or feedback text
- `sortBy` (optional) - Field to sort by (default: `created_at`)
  - Options: `created_at`, `rating`, `customer_name`
- `order` (optional) - Sort order (default: `desc`)
  - Options: `asc`, `desc`

#### Example Requests:
```
GET /api/feedback                                    // All feedback
GET /api/feedback?rating=5                          // Only 5-star ratings
GET /api/feedback?search=great                      // Search for "great"
GET /api/feedback?sortBy=rating&order=asc           // Sort by rating ascending
GET /api/feedback?rating=4&sortBy=created_at        // 4-star, newest first
```

#### Response Format:
```json
{
  "success": true,
  "count": 15,
  "data": [
    {
      "id": 1734567890,
      "customer_name": "John Doe",
      "email": "john@example.com",
      "rating": 5,
      "feedback": "Great service!",
      "timestamp": "2024-12-17T10:30:00.000Z",
      "date": "2024-12-17",
      "created_at": "2024-12-17T10:30:00.000Z",
      "updated_at": "2024-12-17T10:30:00.000Z"
    }
    // ... more feedback items
  ]
}
```

---

### 3. Get Feedback Statistics
**GET** `/api/feedback/stats`

Returns statistics for feedback in the current month (Asia/Kolkata timezone).

#### Response Format:
```json
{
  "success": true,
  "data": {
    "totalFeedback": 45,
    "averageRating": 4.35,
    "ratingDistribution": {
      "1": 2,
      "2": 3,
      "3": 5,
      "4": 15,
      "5": 20
    },
    "recentFeedback": 12,              // Last 7 days
    "trends": {
      "currentWeek": {
        "count": 8,
        "averageRating": 4.5
      },
      "lastWeek": {
        "count": 6,
        "averageRating": 4.2
      },
      "change": {
        "count": 2,                    // +2 compared to last week
        "rating": 0.3                  // +0.3 rating improvement
      }
    }
  }
}
```

#### Statistics Explanation:

1. **totalFeedback**: Total number of feedback submissions in current month
2. **averageRating**: Average rating (1-5 scale) for current month
3. **ratingDistribution**: Count of each rating (1-5)
4. **recentFeedback**: Number of submissions in last 7 days
5. **trends**:
   - **currentWeek**: Count and average for current week (Monday-Sunday)
   - **lastWeek**: Count and average for previous week
   - **change**: Difference between current and last week

---

## Database Schema

### Feedback Table Fields:
- `id`: Feedback ID (e.g., "FB-1734567890")
- `customer_name`: Customer's name (default: "Anonymous")
- `email`: Customer's email (optional)
- `rating`: Rating from 1 to 5
- `feedback`: Feedback text (optional)
- `created_at`: ISO timestamp

---

## Important Notes

1. **Timezone**: All date calculations use **Asia/Kolkata timezone**

2. **Current Month Only**: Statistics endpoint only returns data for the current calendar month

3. **Week Definition**: Weeks start on Monday and end on Sunday

4. **Anonymous Submissions**: Customers can submit feedback without providing name or email

5. **No Update/Delete**: Feedback cannot be updated or deleted once submitted (maintain data integrity)

6. **Rating Scale**: 
   - 1 = Very Poor
   - 2 = Poor
   - 3 = Average
   - 4 = Good
   - 5 = Excellent

---

## Frontend Integration

The frontend already has complete integration:
- **Customer Feedback Form**: Available on main website
- **Admin Feedback Management**: View and analyze all feedback
- **Statistics Dashboard**: Visual charts and insights

All endpoints match the frontend expectations - **no UI changes needed**.

---

## Testing

### Submit Feedback:
```bash
curl -X POST http://localhost:3000/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test User",
    "email": "test@example.com",
    "rating": 5,
    "feedback": "Excellent service!"
  }'
```

### Get All Feedback:
```bash
curl http://localhost:3000/api/feedback
```

### Get Feedback Stats:
```bash
curl http://localhost:3000/api/feedback/stats
```

### Filter by Rating:
```bash
curl "http://localhost:3000/api/feedback?rating=5"
```

### Search Feedback:
```bash
curl "http://localhost:3000/api/feedback?search=excellent"
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
- `201`: Feedback created successfully
- `200`: Success
- `400`: Bad request (invalid rating, missing required fields)
- `500`: Internal server error (database or calculation issues)

---

## Google Sheets Structure

The Feedback sheet in Google Sheets has these columns:
1. Feedback ID
2. Customer Name
3. Email
4. Rating
5. Feedback
6. Submission Date

Data is organized by quarters (Q1_2025_Feedback, Q2_2025_Feedback, etc.) for better performance.
