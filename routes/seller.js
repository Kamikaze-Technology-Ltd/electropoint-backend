// routes/seller.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const sellerController = require('../controllers/sellerController');

// All seller routes require authentication and seller role
router.use(authenticate);
router.use(authorize('seller'));

// Dashboard
router.get('/dashboard/stats', sellerController.getSellerDashboardStats);

// Products
router.get('/products', sellerController.getSellerProducts);

// Orders
router.get('/orders', sellerController.getSellerOrders);


module.exports = router;