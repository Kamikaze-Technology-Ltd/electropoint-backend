// controllers/adminController.js
const pool = require('../config/database');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    // Total sales
    const [salesResult] = await pool.execute(
      'SELECT SUM(final_amount) as total_sales FROM orders WHERE status != "cancelled"'
    );

    // Total orders
    const [ordersResult] = await pool.execute(
      'SELECT COUNT(*) as total_orders FROM orders'
    );

    // Total products
    const [productsResult] = await pool.execute(
      'SELECT COUNT(*) as total_products FROM products'
    );

    // Total users
    const [usersResult] = await pool.execute(
      'SELECT COUNT(*) as total_users FROM users'
    );

    // Recent orders
    const [recentOrders] = await pool.execute(
      `SELECT o.*, u.first_name, u.last_name 
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC
       LIMIT 10`
    );

    // Top selling products
    const [topProducts] = await pool.execute(
      `SELECT p.*, SUM(oi.quantity) as total_sold
       FROM products p
       JOIN order_items oi ON p.id = oi.product_id
       GROUP BY p.id
       ORDER BY total_sold DESC
       LIMIT 10`
    );

    // Sales by month (for chart)
    const [salesByMonth] = await pool.execute(
      `SELECT 
         DATE_FORMAT(created_at, '%Y-%m') as month,
         SUM(final_amount) as revenue,
         COUNT(*) as orders
       FROM orders 
       WHERE status != 'cancelled'
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`
    );

    res.json({
      stats: {
        total_sales: salesResult[0].total_sales || 0,
        total_orders: ordersResult[0].total_orders,
        total_products: productsResult[0].total_products,
        total_users: usersResult[0].total_users,
      },
      recent_orders: recentOrders,
      top_products: topProducts,
      sales_by_month: salesByMonth.reverse(),
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all users
const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];

    if (role) {
      whereClause = 'WHERE role = ?';
      params.push(role);
    }

    const [users] = await pool.execute(
      `SELECT id, first_name, last_name, email, role, is_verified, created_at 
       FROM users 
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );

    res.json({
      users,
      totalPages: Math.ceil(countRows[0].total / limit),
      currentPage: parseInt(page),
      total: countRows[0].total,
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all products for admin
const getProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, vendor } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    if (vendor) {
      whereClause += ' AND p.vendor_id = ?';
      params.push(vendor);
    }

    const [products] = await pool.execute(
      `SELECT p.*, u.first_name, u.last_name, u.email as vendor_email
       FROM products p
       JOIN users u ON p.vendor_id = u.id
       WHERE 1=1 ${whereClause}
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
      `SELECT COUNT(*) as total FROM products p WHERE 1=1 ${whereClause}`,
      params
    );

    res.json({
      products,
      totalPages: Math.ceil(countRows[0].total / limit),
      currentPage: parseInt(page),
      total: countRows[0].total,
    });
  } catch (error) {
    console.error('Get admin products error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get all orders for admin
const getOrders = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params = [];

    if (status) {
      whereClause = 'WHERE o.status = ?';
      params.push(status);
    }

    const [orders] = await pool.execute(
      `SELECT o.*, u.first_name, u.last_name, u.email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Get order items for each order
    for (let order of orders) {
      const [items] = await pool.execute(
        `SELECT oi.*, p.name, p.slug,
          (SELECT image_url FROM product_images 
           WHERE product_id = p.id 
           ORDER BY id LIMIT 1) as image_url
   FROM order_items oi
   JOIN products p ON oi.product_id = p.id
   WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
      params
    );

    res.json({
      orders,
      totalPages: Math.ceil(countRows[0].total / limit),
      currentPage: parseInt(page),
      total: countRows[0].total,
    });
  } catch (error) {
    console.error('Get admin orders error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update user role
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const [result] = await pool.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Update product status
const updateProductStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const [result] = await pool.execute(
      'UPDATE products SET status = ? WHERE id = ?',
      [status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({ message: 'Product status updated successfully' });
  } catch (error) {
    console.error('Update product status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  getProducts,
  getOrders,
  updateUserRole,
  updateProductStatus,
};
