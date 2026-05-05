// backend/routes/categories.js
const express = require('express');
const {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/categoryController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/', getCategories);
router.get('/:id', getCategory);

// Admin only routes
router.post('/', authenticate, authorize('admin'), createCategory);
router.put('/:id', authenticate, authorize('admin'), updateCategory);
router.delete('/:id', authenticate, authorize('admin'), deleteCategory);

module.exports = router;
