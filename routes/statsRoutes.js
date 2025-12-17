import express from "express";
import { 
  getRevenueStats,
  getDashboardStats,
  exportDashboardData,
  getOrdersInsights,
  getSalesInsights
} from "../controllers/statsController.js";

const router = express.Router();

// Stats routes
router.get("/revenue", getRevenueStats);                    // Get revenue statistics (daily/monthly, by payment method)
router.get("/dashboard", getDashboardStats);                // Get dashboard statistics (pending, unpaid, completed, fast-moving)
router.get("/dashboard/export", exportDashboardData);       // Export dashboard data as CSV
router.get("/orders-insights", getOrdersInsights);          // Get completed orders insights (order_status = 'completed')
router.get("/sales", getSalesInsights);                     // Get paid sales insights (payment_status = 'paid')

export default router;
