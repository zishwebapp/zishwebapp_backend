import { getAll, create } from "../services/sheetService.js";
import { generateId } from "../services/idGenerator.js";

/**
 * POST /api/feedback - Submit new feedback
 */
export async function submitFeedback(req, res) {
  try {
    const { customerName, email, rating, feedback } = req.body;

    // Validate required fields
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating is required and must be between 1 and 5"
      });
    }

    console.log(`Creating feedback with rating: ${rating}`);

    // Generate unique feedback ID
    const feedbackId = generateId("FB");
    const now = new Date();
    const timestamp = now.toISOString();

    // Create feedback record
    const feedbackData = {
      id: feedbackId,
      customer_name: customerName || "Anonymous",
      email: email || "",
      rating: rating,
      feedback: feedback || "",
      created_at: timestamp
    };

    // Create feedback in Google Sheets
    await create("feedback", feedbackData);

    console.log(`Feedback ${feedbackId} created successfully`);

    // Return in format expected by frontend
    res.status(201).json({
      success: true,
      message: "Feedback submitted successfully",
      data: {
        id: parseInt(feedbackId.split('-')[1]), // Convert to number for frontend
        customer_name: feedbackData.customer_name,
        email: feedbackData.email,
        rating: feedbackData.rating,
        feedback: feedbackData.feedback,
        timestamp: timestamp,
        date: timestamp.split('T')[0],
        created_at: timestamp,
        updated_at: timestamp
      }
    });

  } catch (error) {
    console.error("Submit feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit feedback",
      error: error.message
    });
  }
}

/**
 * GET /api/feedback - Get all feedback with optional filtering
 */
export async function getAllFeedback(req, res) {
  try {
    console.log("Fetching all feedback...");

    const { rating, search, sortBy, order } = req.query;

    // Get all feedback from current quarter
    let feedbackList = await getAll("feedback");

    // Filter by rating if specified
    if (rating) {
      const ratingNum = parseInt(rating);
      feedbackList = feedbackList.filter(item => parseInt(item.rating) === ratingNum);
    }

    // Search in customer name, email, or feedback text
    if (search) {
      const searchLower = search.toLowerCase();
      feedbackList = feedbackList.filter(item => 
        (item.customer_name && item.customer_name.toLowerCase().includes(searchLower)) ||
        (item.email && item.email.toLowerCase().includes(searchLower)) ||
        (item.feedback && item.feedback.toLowerCase().includes(searchLower))
      );
    }

    // Sort by specified field
    const sortField = sortBy || 'created_at';
    const sortOrder = order === 'asc' ? 1 : -1;

    feedbackList.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle date/timestamp sorting
      if (sortField === 'created_at' || sortField === 'timestamp') {
        aVal = new Date(aVal || 0).getTime();
        bVal = new Date(bVal || 0).getTime();
      }
      // Handle numeric sorting (rating)
      else if (sortField === 'rating') {
        aVal = parseInt(aVal) || 0;
        bVal = parseInt(bVal) || 0;
      }

      if (aVal < bVal) return -1 * sortOrder;
      if (aVal > bVal) return 1 * sortOrder;
      return 0;
    });

    // Transform to frontend format
    const transformedFeedback = feedbackList.map(item => ({
      id: parseInt(item.id.split('-')[1]) || parseInt(item.id),
      customer_name: item.customer_name || "Anonymous",
      email: item.email || null,
      rating: parseInt(item.rating) || 0,
      feedback: item.feedback || null,
      timestamp: item.created_at,
      date: item.created_at ? item.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
      created_at: item.created_at,
      updated_at: item.created_at
    }));

    res.json({
      success: true,
      count: transformedFeedback.length,
      data: transformedFeedback
    });

  } catch (error) {
    console.error("Get all feedback error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch feedback",
      error: error.message
    });
  }
}

/**
 * GET /api/feedback/stats - Get feedback statistics for current month
 */
export async function getFeedbackStats(req, res) {
  try {
    console.log("Fetching feedback statistics...");

    // Get all feedback
    const feedbackList = await getAll("feedback");

    // Get current month boundaries (Asia/Kolkata timezone)
    const now = new Date();
    const today = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Start of current month
    const monthStart = new Date(currentYear, currentMonth, 1);
    monthStart.setHours(0, 0, 0, 0);
    
    // Start of current week (Monday)
    const currentWeekStart = new Date(today);
    const dayOfWeek = currentWeekStart.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    currentWeekStart.setDate(currentWeekStart.getDate() - daysToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);
    
    // Start of last week
    const lastWeekStart = new Date(currentWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    const lastWeekEnd = new Date(currentWeekStart);
    lastWeekEnd.setTime(lastWeekEnd.getTime() - 1);

    // Filter feedback for current month
    const monthFeedback = feedbackList.filter(item => {
      if (!item.created_at) return false;
      const itemDate = new Date(item.created_at);
      return itemDate >= monthStart && itemDate.getMonth() === currentMonth && itemDate.getFullYear() === currentYear;
    });

    // Calculate statistics
    const totalFeedback = monthFeedback.length;
    
    // Average rating
    const totalRating = monthFeedback.reduce((sum, item) => sum + (parseInt(item.rating) || 0), 0);
    const averageRating = totalFeedback > 0 ? totalRating / totalFeedback : 0;

    // Rating distribution
    const ratingDistribution = {
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
      "5": 0
    };

    monthFeedback.forEach(item => {
      const rating = parseInt(item.rating);
      if (rating >= 1 && rating <= 5) {
        ratingDistribution[rating.toString()] += 1;
      }
    });

    // Recent feedback (last 7 days)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentFeedback = monthFeedback.filter(item => {
      if (!item.created_at) return false;
      const itemDate = new Date(item.created_at);
      return itemDate >= sevenDaysAgo;
    }).length;

    // Trends - current week vs last week
    const currentWeekFeedback = monthFeedback.filter(item => {
      if (!item.created_at) return false;
      const itemDate = new Date(item.created_at);
      return itemDate >= currentWeekStart;
    });

    const lastWeekFeedback = monthFeedback.filter(item => {
      if (!item.created_at) return false;
      const itemDate = new Date(item.created_at);
      return itemDate >= lastWeekStart && itemDate <= lastWeekEnd;
    });

    const currentWeekCount = currentWeekFeedback.length;
    const lastWeekCount = lastWeekFeedback.length;

    const currentWeekRating = currentWeekCount > 0 
      ? currentWeekFeedback.reduce((sum, item) => sum + (parseInt(item.rating) || 0), 0) / currentWeekCount
      : 0;

    const lastWeekRating = lastWeekCount > 0
      ? lastWeekFeedback.reduce((sum, item) => sum + (parseInt(item.rating) || 0), 0) / lastWeekCount
      : 0;

    res.json({
      success: true,
      data: {
        totalFeedback,
        averageRating: parseFloat(averageRating.toFixed(2)),
        ratingDistribution,
        recentFeedback,
        trends: {
          currentWeek: {
            count: currentWeekCount,
            averageRating: parseFloat(currentWeekRating.toFixed(2))
          },
          lastWeek: {
            count: lastWeekCount,
            averageRating: parseFloat(lastWeekRating.toFixed(2))
          },
          change: {
            count: currentWeekCount - lastWeekCount,
            rating: parseFloat((currentWeekRating - lastWeekRating).toFixed(2))
          }
        }
      }
    });

  } catch (error) {
    console.error("Get feedback stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch feedback statistics",
      error: error.message
    });
  }
}
