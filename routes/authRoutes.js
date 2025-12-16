import express from "express";
import { login, register, getCurrentUser } from "../controllers/authController.js";

const router = express.Router();

// Authentication routes
router.post("/login", login);           // Login user
router.post("/register", register);     // Register new user
router.get("/me", getCurrentUser);      // Get current user info

export default router;
