// middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res
        .status(401)
        .json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    );

    // Get user from database
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, role, is_verified FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = users[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'your-secret-key'
      );
      const [users] = await pool.execute(
        'SELECT id, email, first_name, last_name, role, is_verified FROM users WHERE id = ?',
        [decoded.userId]
      );

      if (users.length > 0) {
        req.user = users[0];
      }
    }
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Access denied. Insufficient permissions.',
      });
    }
    next();
  };
};

module.exports = { authenticate, optionalAuthenticate, authorize };
