// routes/auth.js
const express = require('express');
const { body } = require('express-validator');
const {
  register,
  login,
  getProfile,
  updateProfile,
  logout,
  becomeSeller,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('first_name').notEmpty().trim(),
  body('last_name').notEmpty().trim(),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/become-seller', authenticate, becomeSeller);

module.exports = router;
