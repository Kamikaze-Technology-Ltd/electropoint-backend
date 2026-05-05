// routes/reviews.js
const express = require('express');
const {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
} = require('../controllers/reviewController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/products/:id/reviews', getProductReviews);
router.post('/products/:id/reviews', authenticate, createReview);
router.put('/reviews/:id', authenticate, updateReview);
router.delete('/reviews/:id', authenticate, deleteReview);

module.exports = router;
