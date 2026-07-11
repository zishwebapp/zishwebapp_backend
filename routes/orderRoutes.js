import express from "express";
import {
  placeOrder,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderItemStatus,
  addOrderItem,
  updateOrderItemQuantity,
  removeOrderItem,
  updatePaymentStatus,
  getOrdersByCustomer,
  getOrderStats,
  deleteOrder,
  checkDataIntegrity
} from "../controllers/orderController.js";

const router = express.Router();

// Order management routes
router.post("/", placeOrder);                          // Place new order
router.get("/stats/orders", getOrderStats);            // Get order statistics (MUST be before /:id route)
router.get("/integrity-check", checkDataIntegrity);    // Check data integrity (MUST be before /:id route)
router.get("/", getAllOrders);                         // Get all orders
router.get("/customer/:phone", getOrdersByCustomer);   // Get orders by customer phone
router.get("/:id", getOrderById);                      // Get single order by ID
router.put("/:id/status", updateOrderStatus);          // Update order status
router.put("/:orderId/items/:itemId/status", updateOrderItemStatus); // Update single item delivery status
router.post("/:orderId/items", addOrderItem);                        // Add a new item to an order
router.put("/:orderId/items/:itemId/quantity", updateOrderItemQuantity); // Change an item's quantity
router.delete("/:orderId/items/:itemId", removeOrderItem);           // Remove an item from an order
router.put("/:id/payment", updatePaymentStatus);       // Update payment status
router.delete("/:id", deleteOrder);                    // Delete order and related records

export default router;
