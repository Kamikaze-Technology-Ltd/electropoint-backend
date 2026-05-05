// routes/orders.js
const express = require('express');
const {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
} = require('../controllers/orderController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', getOrders);
router.get('/number/:orderNumber', getOrder);
router.post('/', createOrder);
router.put(
  '/number/:orderNumber/status',
  authorize('admin', 'seller'),
  updateOrderStatus
);

module.exports = router;
