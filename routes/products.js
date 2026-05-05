// routes/products.js
const express = require("express");
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getFeaturedProducts,
  getBestProducts,
  getFlashSaleProducts,
  getNewArrivals,
  searchProducts,
  getProductsByCategory,
  setFeatured,
  setFlashSale,
  submitPaymentReceipt,
  getPaymentReceipts,
  updatePaymentReceiptStatus, // ← added
} = require("../controllers/productController");
const { authenticate, authorize } = require("../middleware/auth");

const router = express.Router();

// Public routes
router.get("/", getProducts);
router.get("/featured", getFeaturedProducts);
router.get("/best", getBestProducts);
router.get("/flash-sale", getFlashSaleProducts);
router.get("/new-arrivals", getNewArrivals);
router.get("/category/:categorySlug", getProductsByCategory);
router.get("/search", searchProducts);
router.get("/:slug", getProduct);

// Protected routes
router.post("/", authenticate, authorize("seller", "admin"), ...createProduct);
router.put(
  "/:id",
  authenticate,
  authorize("seller", "admin"),
  ...updateProduct,
);
router.put("/:id/featured", authenticate, authorize("admin"), setFeatured);
router.put("/:id/flash-sale", authenticate, authorize("admin"), setFlashSale);
router.delete(
  "/:id",
  authenticate,
  authorize("seller", "admin"),
  deleteProduct,
);

router.post("/receipt", authenticate, ...submitPaymentReceipt);
router.get(
  "/receipts/all",
  authenticate,
  authorize("admin"),
  getPaymentReceipts,
);
router.put(
  "/receipts/:id/status",
  authenticate,
  authorize("admin"),
  updatePaymentReceiptStatus,
);
module.exports = router;
