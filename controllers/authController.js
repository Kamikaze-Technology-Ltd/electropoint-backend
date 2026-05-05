// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { validationResult } = require('express-validator');

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', {
    expiresIn: '30d',
  });
};

// Register user
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      first_name,
      last_name,
      email,
      password,
      role = 'customer',
    } = req.body;

    // Check if user exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res
        .status(400)
        .json({ message: 'User already exists with this email' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const [result] = await pool.execute(
      'INSERT INTO users (first_name, last_name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [first_name, last_name, email, hashedPassword, role]
    );

    const token = generateToken(result.insertId);

    // Get created user (without password)
    const [users] = await pool.execute(
      'SELECT id, first_name, last_name, email, role, is_verified, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: users[0],
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Check if user exists
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [
      email,
    ]);

    if (users.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const user = users[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// Get user profile
const getProfile = async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, first_name, last_name, email, role, is_verified, avatar, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(users[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;
    const userId = req.user.id;

    // Check if email is already taken by another user
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [email, userId]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    await pool.execute(
      'UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?',
      [first_name, last_name, email, userId]
    );

    // Get updated user
    const [users] = await pool.execute(
      'SELECT id, first_name, last_name, email, role, is_verified, avatar, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'Profile updated successfully',
      user: users[0],
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Logout (client-side token removal)
const logout = (req, res) => {
  res.json({ message: 'Logout successful' });
};

// Become a seller
const becomeSeller = async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.execute('UPDATE users SET role = "seller" WHERE id = ?', [
      userId,
    ]);

    res.json({
      message: 'You are now a seller. You can start adding products.',
    });
  } catch (error) {
    console.error('Become seller error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  logout,
  becomeSeller,
};
