// routes/newsletter.js
const express = require('express');
const {
  subscribe,
  unsubscribe,
  getSubscribers,
  sendNewsletter,
  getCampaigns,
  bulkUnsubscribe,
} = require('../controllers/newsletterController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/subscribe', subscribe);
router.post('/unsubscribe', unsubscribe);

// Admin routes
router.get('/subscribers', authenticate, authorize('admin'), getSubscribers);
router.post('/send', authenticate, authorize('admin'), sendNewsletter);
router.get('/campaigns', authenticate, authorize('admin'), getCampaigns);
router.post(
  '/bulk-unsubscribe',
  authenticate,
  authorize('admin'),
  bulkUnsubscribe
);

module.exports = router;
