// controllers/reviewController.js
const pool = require('../config/database');

// Get product reviews
const getProductReviews = async (req, res) => {
  try {
    const { id } = req.params;

    const [reviews] = await pool.execute(
      `SELECT r.*, u.first_name, u.last_name 
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ?
       ORDER BY r.created_at DESC`,
      [id]
    );

    res.json(reviews);
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create review
const createReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const user_id = req.user.id;

    // Check if user has purchased the product
    const [orders] = await pool.execute(
      `SELECT oi.id FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.user_id = ? AND oi.product_id = ? AND o.status = 'delivered'`,
      [user_id, id]
    );

    if (orders.length === 0) {
      return res.status(400).json({
        message: 'You can only review products you have purchased',
      });
    }

    // Check if already reviewed
    const [existing] = await pool.execute(
      'SELECT id FROM reviews WHERE user_id = ? AND product_id = ?',
      [user_id, id]
    );

    if (existing.length > 0) {
      return res
        .status(400)
        .json({ message: 'You have already reviewed this product' });
    }

    // Create review
    await pool.execute(
      'INSERT INTO reviews (user_id, product_id, rating, comment) VALUES (?, ?, ?, ?)',
      [user_id, id, rating, comment]
    );

    // Update product rating and review count
    const [reviews] = await pool.execute(
      'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE product_id = ?',
      [id]
    );

    const { avg_rating, count } = reviews[0];

    await pool.execute(
      'UPDATE products SET rating_avg = ?, review_count = ? WHERE id = ?',
      [parseFloat(avg_rating).toFixed(2), count, id]
    );

    res.status(201).json({ message: 'Review added successfully' });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update review
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const user_id = req.user.id;

    const [result] = await pool.execute(
      'UPDATE reviews SET rating = ?, comment = ? WHERE id = ? AND user_id = ?',
      [rating, comment, id, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Review updated successfully' });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete review
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const [result] = await pool.execute(
      'DELETE FROM reviews WHERE id = ? AND user_id = ?',
      [id, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Review not found' });
    }

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview,
};
