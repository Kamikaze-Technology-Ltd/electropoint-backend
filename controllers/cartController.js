// controllers/cartController.js
const pool = require('../config/database');

// Get user cart
const getCart = async (req, res) => {
  try {
    const [cartItems] = await pool.execute(
      `SELECT c.*, p.name, p.price, p.sale_price, p.stock, pi.image_url, p.slug
       FROM cart c
       JOIN products p ON c.product_id = p.id
       LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.id = (
         SELECT id FROM product_images WHERE product_id = p.id LIMIT 1
       )
       WHERE c.user_id = ?`,
      [req.user.id]
    );

    // Calculate total for each item and overall total
    let total = 0;
    const cart = cartItems.map((item) => {
      const price = item.sale_price || item.price;
      const itemTotal = price * item.quantity;
      total += itemTotal;

      return {
        ...item,
        current_price: price,
        item_total: itemTotal,
      };
    });

    res.json({ cart, total });
  } catch (error) {
    console.error('Get cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add to cart
const addToCart = async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    const user_id = req.user.id;

    // Check if product exists and is in stock
    const [products] = await pool.execute(
      'SELECT id, stock FROM products WHERE id = ? AND status = "active"',
      [product_id]
    );

    if (products.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const product = products[0];

    if (product.stock < quantity) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    // Check if item already in cart
    const [existing] = await pool.execute(
      'SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ?',
      [user_id, product_id]
    );

    if (existing.length > 0) {
      // Update quantity
      const newQuantity = existing[0].quantity + quantity;
      if (newQuantity > product.stock) {
        return res.status(400).json({ message: 'Insufficient stock' });
      }

      await pool.execute('UPDATE cart SET quantity = ? WHERE id = ?', [
        newQuantity,
        existing[0].id,
      ]);
    } else {
      // Insert new cart item
      await pool.execute(
        'INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)',
        [user_id, product_id, quantity]
      );
    }

    res.status(201).json({ message: 'Product added to cart' });
  } catch (error) {
    console.error('Add to cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update cart item quantity
const updateCartItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const user_id = req.user.id;

    if (quantity < 1) {
      return res.status(400).json({ message: 'Quantity must be at least 1' });
    }

    // Check if cart item exists and belongs to user
    const [cartItems] = await pool.execute(
      'SELECT c.*, p.stock FROM cart c JOIN products p ON c.product_id = p.id WHERE c.id = ? AND c.user_id = ?',
      [id, user_id]
    );

    if (cartItems.length === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    const cartItem = cartItems[0];

    if (quantity > cartItem.stock) {
      return res.status(400).json({ message: 'Insufficient stock' });
    }

    await pool.execute('UPDATE cart SET quantity = ? WHERE id = ?', [
      quantity,
      id,
    ]);

    res.json({ message: 'Cart updated' });
  } catch (error) {
    console.error('Update cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Remove from cart
const removeFromCart = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    const [result] = await pool.execute(
      'DELETE FROM cart WHERE id = ? AND user_id = ?',
      [id, user_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Cart item not found' });
    }

    res.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Clear cart
const clearCart = async (req, res) => {
  try {
    await pool.execute('DELETE FROM cart WHERE user_id = ?', [req.user.id]);

    res.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear cart error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
};
