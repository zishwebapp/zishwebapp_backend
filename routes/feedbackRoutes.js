import express from "express";
import { 
  submitFeedback,
  getAllFeedback,
  getFeedbackStats
} from "../controllers/feedbackController.js";

const router = express.Router();

// Feedback routes
router.post("/", submitFeedback);                    // Submit new feedback
router.get("/stats", getFeedbackStats);              // Get feedback statistics (must be before /:id)
router.get("/", getAllFeedback);                     // Get all feedback with optional filters

export default router;
