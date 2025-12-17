import express from "express";
import { 
  getRevenueStats,
  getDashboardStats,
  exportDashboardData
} from "../controllers/statsController.js";

const router = express.Router();

// Stats routes
router.get("/revenue", getRevenueStats);                    // Get revenue statistics (daily/monthly, by payment method)
router.get("/dashboard", getDashboardStats);                // Get dashboard statistics (pending, unpaid, completed, fast-moving)
router.get("/dashboard/export", exportDashboardData);       // Export dashboard data as CSV

export default router;
