// routes/wishlistRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const wishlistController = require('../controllers/wishlistController');

// Public routes
router.get('/public/:shareLink', wishlistController.getPublicWishlist);

// Protected routes
router.get('/', authenticate, wishlistController.getWishlists);
router.post('/', authenticate, wishlistController.createWishlist);
router.get('/:id', authenticate, wishlistController.getWishlist);
router.put('/:id', authenticate, wishlistController.updateWishlist);
router.delete('/:id', authenticate, wishlistController.deleteWishlist);
router.post('/items', authenticate, wishlistController.addToWishlist);
router.delete(
  '/items/:wishlistItemId',
  authenticate,
  wishlistController.removeFromWishlist
);

module.exports = router;
