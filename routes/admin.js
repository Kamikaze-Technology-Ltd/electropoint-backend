// routes/admin.js
const express = require("express");
const {
  getDashboardStats,
  getUsers,
  getProducts,
  getOrders,
  updateUserRole,
  updateProductStatus,
} = require("../controllers/adminController");
const { authenticate, authorize } = require("../middleware/auth");
const { getProductsByStatus } = require("../controllers/productController");

const router = express.Router();

router.use(authenticate, authorize("admin"));

router.get("/stats", getDashboardStats);
router.get("/users", getUsers);
router.get("/products", getProducts);
router.get("/products/status", getProductsByStatus);
router.get("/orders", getOrders);
router.put("/users/:id/role", updateUserRole);
router.put("/products/:id/status", updateProductStatus);
router.get("/category/:categorySlug/status/:status", getProductsByStatus);

module.exports = router;
