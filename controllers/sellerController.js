// controllers/sellerController.js
const pool = require('../config/database');
const upload = require('../middleware/upload');

// Get seller dashboard statistics
const getSellerDashboardStats = async (req, res) => {
  try {
    const sellerId = req.user.id;

    // Total sales and earnings
    const [salesResult] = await pool.execute(
      `SELECT 
         SUM(oi.price * oi.quantity) as total_sales,
         COUNT(DISTINCT o.id) as total_orders
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       WHERE p.vendor_id = ? AND o.status != 'cancelled'`,
      [sellerId]
    );

    // Total products
    const [productsResult] = await pool.execute(
      'SELECT COUNT(*) as total_products FROM products WHERE vendor_id = ?',
      [sellerId]
    );

    // Pending orders
    const [pendingOrdersResult] = await pool.execute(
      `SELECT COUNT(DISTINCT o.id) as pending_orders
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       WHERE p.vendor_id = ? AND o.status IN ('pending', 'confirmed', 'processing')`,
      [sellerId]
    );

    // Recent orders
    const [recentOrders] = await pool.execute(
      `SELECT DISTINCT o.*, u.first_name, u.last_name, u.email
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       JOIN users u ON o.user_id = u.id
       WHERE p.vendor_id = ?
       ORDER BY o.created_at DESC
       LIMIT 10`,
      [sellerId]
    );

    // Get order items for each recent order
    for (let order of recentOrders) {
      const [items] = await pool.execute(
        `SELECT oi.*, p.name, p.slug,
          (SELECT image_url FROM product_images 
           WHERE product_id = p.id 
           ORDER BY id LIMIT 1) as image_url
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ? AND p.vendor_id = ?`,
        [order.id, sellerId]
      );
      order.items = items;
    }

    // Get top selling products
    const [topProducts] = await pool.execute(
      `SELECT p.*, SUM(oi.quantity) as total_sold
       FROM products p
       LEFT JOIN order_items oi ON p.id = oi.product_id
       WHERE p.vendor_id = ?
       GROUP BY p.id
       ORDER BY total_sold DESC
       LIMIT 5`,
      [sellerId]
    );

    return res.json({
      stats: {
        total_sales: salesResult[0].total_sales || 0,
        total_orders: salesResult[0].total_orders || 0,
        total_products: productsResult[0].total_products,
        pending_orders: pendingOrdersResult[0].pending_orders || 0,
      },
      recent_orders: recentOrders,
      top_products: topProducts,
    });
  } catch (error) {
    console.error('Get seller dashboard stats error:', error);
    return res.status(500).json({ message: 'Server error', error: error });
  }
};

// Get seller products
const getSellerProducts = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { page = 1, limit = 10, status, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE vendor_id = ?';
    const params = [sellerId];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    const [products] = await pool.execute(
      `SELECT p.*, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Get images for each product
    for (let product of products) {
      const [images] = await pool.execute(
        'SELECT image_url FROM product_images WHERE product_id = ?',
        [product.id]
      );
      product.images = images.map((img) => img.image_url);
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM products ${whereClause}`,
      params
    );

    console.log(products)

    res.json({
      products,
      totalPages: Math.ceil(countRows[0].total / limit),
      currentPage: parseInt(page),
      total: countRows[0].total,
    });
  } catch (error) {
    console.error('Get seller products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get seller orders
const getSellerOrders = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE p.vendor_id = ?';
    const params = [sellerId];

    if (status) {
      whereClause += ' AND o.status = ?';
      params.push(status);
    }

    // Get orders that have the seller's products
    const [orders] = await pool.execute(
      `SELECT DISTINCT o.*, u.first_name, u.last_name, u.email
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       JOIN users u ON o.user_id = u.id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Get order items for each order (only seller's products)
    for (let order of orders) {
      const [items] = await pool.execute(
        `SELECT oi.*, p.name, p.slug,
          (SELECT image_url FROM product_images 
           WHERE product_id = p.id 
           ORDER BY id LIMIT 1) as image_url
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = ? AND p.vendor_id = ?`,
        [order.id, sellerId]
      );
      order.items = items;

      // Calculate seller's total for this order
      order.seller_total = items.reduce((sum, item) =>
        sum + (item.price * item.quantity), 0
      );
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(DISTINCT o.id) as total
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN products p ON oi.product_id = p.id
       ${whereClause}`,
      params
    );

    res.json({
      orders,
      totalPages: Math.ceil(countRows[0].total / limit),
      currentPage: parseInt(page),
      total: countRows[0].total,
    });
  } catch (error) {
    console.error('Get seller orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};


module.exports = {
  getSellerDashboardStats,
  getSellerProducts,
  getSellerOrders,
};