import express from "express";
import { createSale, listSales, deleteSale } from "../controllers/salesController.js";

const router = express.Router();

router.get("/", listSales);        // List sales (range/search filters)
router.post("/", createSale);      // Log a sale
router.delete("/:id", deleteSale); // Delete a sale entry

export default router;
