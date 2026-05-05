// routes/coupons.js
const express = require('express');
const {
  getCoupons,
  validateCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require('../controllers/couponController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, authorize('admin'), getCoupons);
router.get('/validate', authenticate, validateCoupon);
router.post('/', authenticate, authorize('admin'), createCoupon);
router.put('/:id', authenticate, authorize('admin'), updateCoupon);
router.delete('/:id', authenticate, authorize('admin'), deleteCoupon);

module.exports = router;
