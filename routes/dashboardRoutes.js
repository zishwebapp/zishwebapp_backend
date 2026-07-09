import express from "express";
import { getDashboardSummary } from "../controllers/dashboardController.js";

const router = express.Router();

router.get("/summary", getDashboardSummary); // All 8 dashboard cards in one call

export default router;
