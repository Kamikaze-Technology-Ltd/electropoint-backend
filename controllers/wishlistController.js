// controllers/wishlistController.js - Enhanced Version
const pool = require('../config/database');
const crypto = require('crypto');
const { paymentAPI } = require('../services/paymentService');

// Generate unique wishlist link
const generateUniqueLink = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Get user's wishlists
const getWishlists = async (req, res) => {
  try {
    const [wishlists] = await pool.execute(
      `SELECT w.*, 
        COUNT(wi.id) as item_count,
        SUM(COALESCE(p.sale_price, p.price)) as total_value
       FROM wishlists w
       LEFT JOIN wishlist_items wi ON w.id = wi.wishlist_id
       LEFT JOIN products p ON wi.product_id = p.id
       WHERE w.user_id = ?
       GROUP BY w.id
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );

    // Get items for each wishlist
    for (let wishlist of wishlists) {
      const [items] = await pool.execute(
        `SELECT wi.*, p.name, p.price, p.sale_price, p.rating_avg, p.review_count, 
                pi.image_url, p.slug, p.category_slug, p.stock,
                (SELECT COUNT(*) FROM wishlist_purchases wp WHERE wp.wishlist_item_id = wi.id) as purchased_count
         FROM wishlist_items wi
         JOIN products p ON wi.product_id = p.id
         LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.id = (
           SELECT id FROM product_images WHERE product_id = p.id LIMIT 1
         )
         WHERE wi.wishlist_id = ?`,
        [wishlist.id]
      );
      wishlist.items = items;
    }

    res.json(wishlists);
  } catch (error) {
    console.error('Get wishlists error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get specific wishlist
const getWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const [wishlists] = await pool.execute(
      `SELECT w.*, 
        COUNT(wi.id) as item_count,
        SUM(COALESCE(p.sale_price, p.price)) as total_value
       FROM wishlists w
       LEFT JOIN wishlist_items wi ON w.id = wi.wishlist_id
       LEFT JOIN products p ON wi.product_id = p.id
       WHERE w.id = ? AND w.user_id = ?
       GROUP BY w.id`,
      [id, user_id]
    );

    if (wishlists.length === 0) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    const wishlist = wishlists[0];

    // Get wishlist items
    const [items] = await pool.execute(
      `SELECT wi.*, p.name, p.price, p.sale_price, p.rating_avg, p.review_count, 
              pi.image_url, p.slug, p.category_slug, p.stock,
              (SELECT COUNT(*) FROM wishlist_purchases wp WHERE wp.wishlist_item_id = wi.id) as purchased_count
       FROM wishlist_items wi
       JOIN products p ON wi.product_id = p.id
       LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.id = (
         SELECT id FROM product_images WHERE product_id = p.id LIMIT 1
       )
       WHERE wi.wishlist_id = ?`,
      [id]
    );

    wishlist.items = items;

    res.json(wishlist);
  } catch (error) {
    console.error('Get wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get public wishlist by share link
const getPublicWishlist = async (req, res) => {
  try {
    const { shareLink } = req.params;

    const [wishlists] = await pool.execute(
      `SELECT w.*, u.first_name, u.last_name 
       FROM wishlists w 
       JOIN users u ON w.user_id = u.id 
       WHERE w.share_link = ? AND w.is_public = true`,
      [shareLink]
    );

    if (wishlists.length === 0) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    const wishlist = wishlists[0];

    // Get wishlist items
    const [items] = await pool.execute(
      `SELECT wi.*, p.name, p.price, p.sale_price, p.rating_avg, p.review_count, 
              pi.image_url, p.slug, p.category_slug, p.stock,
              (SELECT COUNT(*) FROM wishlist_purchases wp WHERE wp.wishlist_item_id = wi.id) as purchased_count
       FROM wishlist_items wi
       JOIN products p ON wi.product_id = p.id
       LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.id = (
         SELECT id FROM product_images WHERE product_id = p.id LIMIT 1
       )
       WHERE wi.wishlist_id = ?`,
      [wishlist.id]
    );

    wishlist.items = items;

    res.json(wishlist);
  } catch (error) {
    console.error('Get public wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new wishlist
const createWishlist = async (req, res) => {
  try {
    const { name, description = '', is_public = true } = req.body;
    const user_id = req.user.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Wishlist name is required' });
    }

    const share_link = generateUniqueLink();

    const [result] = await pool.execute(
      'INSERT INTO wishlists (user_id, name, description, is_public, share_link) VALUES (?, ?, ?, ?, ?)',
      [user_id, name.trim(), description, is_public, share_link]
    );

    const [wishlists] = await pool.execute(
      'SELECT * FROM wishlists WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(wishlists[0]);
  } catch (error) {
    console.error('Create wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add item to wishlist
const addToWishlist = async (req, res) => {
  try {
    const { wishlist_id, product_id, quantity = 1, note = '' } = req.body;
    const user_id = req.user.id;

    // Verify wishlist belongs to user
    const [wishlists] = await pool.execute(
      'SELECT id FROM wishlists WHERE id = ? AND user_id = ?',
      [wishlist_id, user_id]
    );

    if (wishlists.length === 0) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    // Check if product exists
    const [products] = await pool.execute(
      'SELECT id FROM products WHERE id = ?',
      [product_id]
    );

    if (products.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if already in wishlist
    const [existing] = await pool.execute(
      'SELECT id FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?',
      [wishlist_id, product_id]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Product already in wishlist' });
    }

    await pool.execute(
      'INSERT INTO wishlist_items (wishlist_id, product_id, quantity, note) VALUES (?, ?, ?, ?)',
      [wishlist_id, product_id, quantity, note]
    );

    res.status(201).json({ message: 'Product added to wishlist' });
  } catch (error) {
    console.error('Add to wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove item from wishlist
const removeFromWishlist = async (req, res) => {
  try {
    const { wishlistItemId } = req.params;
    const user_id = req.user.id;

    const [result] = await pool.execute(
      `DELETE wi FROM wishlist_items wi
       JOIN wishlists w ON wi.wishlist_id = w.id
       WHERE wi.id = ? AND w.user_id = ?`,
      [wishlistItemId, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Wishlist item not found' });
    }

    res.json({ message: 'Item removed from wishlist' });
  } catch (error) {
    console.error('Remove from wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update wishlist
const updateWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_public } = req.body;
    const user_id = req.user.id;

    if (!name || name.trim() === '') {
      return res.status(400).json({ message: 'Wishlist name is required' });
    }

    const [result] = await pool.execute(
      'UPDATE wishlists SET name = ?, description = ?, is_public = ? WHERE id = ? AND user_id = ?',
      [name.trim(), description, is_public, id, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Wishlist not found' });
    }

    res.json({ message: 'Wishlist updated successfully' });
  } catch (error) {
    console.error('Update wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete wishlist
const deleteWishlist = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Delete wishlist items first
      await connection.execute(
        'DELETE FROM wishlist_items WHERE wishlist_id = ?',
        [id]
      );

      // Then delete the wishlist
      const [result] = await connection.execute(
        'DELETE FROM wishlists WHERE id = ? AND user_id = ?',
        [id, user_id]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(404).json({ message: 'Wishlist not found' });
      }

      await connection.commit();
      res.json({ message: 'Wishlist deleted successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Delete wishlist error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getWishlists,
  getWishlist,
  getPublicWishlist,
  createWishlist,
  addToWishlist,
  removeFromWishlist,
  updateWishlist,
  deleteWishlist,
};
