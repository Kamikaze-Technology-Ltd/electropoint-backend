// controllers/orderController.js
const pool = require('../config/database');

// Generate unique order number
const generateOrderNumber = () => {
  return (
    'ORD' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase()
  );
};

// Get user orders
const getOrders = async (req, res) => {
  try {
    const user_id = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT o.*, c.code as coupon_code
      FROM orders o
      LEFT JOIN coupons c ON o.coupon_id = c.id
      WHERE o.user_id = ?
      ORDER BY o.created_at DESC
    `;

    if (limit) {
      query += ' LIMIT ? OFFSET ?';
    }

    const [orders] = limit
      ? await pool.execute(query, [user_id, parseInt(limit), offset])
      : await pool.execute(query, [user_id]);

    // Get order items for each order
    for (let order of orders) {
      const [items] = await pool.execute(
        `SELECT oi.*, p.name, p.slug, pi.image_url
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.id = (
           SELECT id FROM product_images WHERE product_id = p.id LIMIT 1
         )
         WHERE oi.order_id = ?`,
        [order.id]
      );
      order.items = items;
    }
    console.log(orders);

    // Get total count for pagination
    const [countRows] = await pool.execute(
      'SELECT COUNT(*) as total FROM orders WHERE user_id = ?',
      [user_id]
    );

    res.json({
      success: true,
      data: {
        orders,
        totalPages: Math.ceil(countRows[0].total / limit),
        currentPage: parseInt(page),
        total: countRows[0].total,
      },
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get single order
const getOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const user_id = req.user.id;

    const [orders] = await pool.execute(
      `SELECT o.*, c.code as coupon_code
       FROM orders o
       LEFT JOIN coupons c ON o.coupon_id = c.id
       WHERE o.order_number = ? AND o.user_id = ?`,
      [orderNumber, user_id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    const order = orders[0];

    // Get order items
    const [items] = await pool.execute(
      `SELECT oi.*, p.name, p.slug, pi.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.id = (
         SELECT id FROM product_images WHERE product_id = p.id LIMIT 1
       )
       WHERE oi.order_id = ?`,
      [order.id]
    );

    order.items = items;

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error('Get order by number error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Create order
const createOrder = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { items, shippingAddress, couponCode, paymentMethod } = req.body;

    const user_id = req.user.id;

    // Validate items and calculate total
    let total_amount = 0;
    const orderItems = [];

    for (const item of items) {
      const [products] = await connection.execute(
        'SELECT id, price, sale_price, stock FROM products WHERE id = ? AND status = "active"',
        [item.productId]
      );

      if (products.length === 0) {
        throw new Error(`Product ${item.productId} not found`);
      }

      const product = products[0];
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.id}`);
      }

      const price = product.sale_price || product.price;
      const itemTotal = price * item.quantity;
      total_amount += itemTotal;

      orderItems.push({
        product_id: item.productId,
        quantity: item.quantity,
        price,
      });

      // Update product stock
      await connection.execute(
        'UPDATE products SET stock = stock - ? WHERE id = ?',
        [item.quantity, item.productId]
      );
    }

    // Apply coupon if provided
    let discount_amount = 0;
    let coupon_id = null;

    if (couponCode) {
      const currentDate = new Date();
      const [coupons] = await connection.execute(
        `SELECT * FROM coupons 
         WHERE code = ? 
         AND status = 'active'
         AND (valid_from IS NULL OR valid_from <= ?)
         AND (valid_until IS NULL OR valid_until >= ?)`,
        [couponCode, currentDate, currentDate]
      );

      if (coupons.length > 0) {
        const coupon = coupons[0];

        if (!coupon.usage_limit || coupon.used_count < coupon.usage_limit) {
          if (total_amount >= coupon.min_order_amount) {
            if (coupon.discount_type === 'percentage') {
              discount_amount = (total_amount * coupon.discount_value) / 100;
              if (
                coupon.max_discount_amount &&
                discount_amount > coupon.max_discount_amount
              ) {
                discount_amount = coupon.max_discount_amount;
              }
            } else {
              discount_amount = coupon.discount_value;
            }

            coupon_id = coupon.id;

            // Update coupon usage
            await connection.execute(
              'UPDATE coupons SET used_count = used_count + 1 WHERE id = ?',
              [coupon.id]
            );
          }
        }
      }
    }

    // Calculate shipping and tax based on frontend logic
    const shipping_amount = total_amount > 50000 ? 0 : 1500;
    const tax_amount = total_amount * 0.075;
    const final_amount =
      total_amount + shipping_amount + tax_amount - discount_amount;

    // Create order
    const order_number = generateOrderNumber();
    const [orderResult] = await connection.execute(
      `INSERT INTO orders (
    order_number, user_id, total_amount, discount_amount, 
    shipping_amount, tax_amount, final_amount, coupon_id, shipping_address, 
    payment_method
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order_number,
        user_id,
        total_amount,
        discount_amount,
        shipping_amount,
        tax_amount, // Include tax amount
        final_amount,
        coupon_id,
        JSON.stringify(shippingAddress),
        paymentMethod,
      ]
    );

    const order_id = orderResult.insertId;

    // Create order items
    for (const item of orderItems) {
      await connection.execute(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [order_id, item.product_id, item.quantity, item.price]
      );

      // Update product sales count
      await connection.execute(
        'UPDATE products SET sales_count = sales_count + ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    // Clear user's cart
    await connection.execute('DELETE FROM cart WHERE user_id = ?', [user_id]);

    await connection.commit();

    // Get created order with items
    const [orders] = await connection.execute(
      `SELECT o.*, c.code as coupon_code
       FROM orders o
       LEFT JOIN coupons c ON o.coupon_id = c.id
       WHERE o.id = ?`,
      [order_id]
    );

    const order = orders[0];

    // Get order items
    const [itemsData] = await connection.execute(
      `SELECT oi.*, p.name, p.slug, pi.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_images pi ON p.id = pi.product_id AND pi.id = (
         SELECT id FROM product_images WHERE product_id = p.id LIMIT 1
       )
       WHERE oi.order_id = ?`,
      [order_id]
    );

    order.items = itemsData;

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: order,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Create order error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Server error',
    });
  } finally {
    connection.release();
  }
};

// Update order status (admin/seller)
const updateOrderStatus = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { orderNumber } = req.params;
    const { status, notes } = req.body; // Added optional notes field

    // Validate input
    if (!orderNumber) {
      return res.status(400).json({
        success: false,
        message: 'Order number is required',
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required',
      });
    }

    // Validate status
    const validStatuses = [
      'pending',
      'confirmed',
      'shipped',
      'processing',
      'delivered',
      'cancelled',
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    await connection.beginTransaction();

    // First, check if order exists and get current status
    const [orders] = await connection.execute(
      'SELECT id, status FROM orders WHERE order_number = ?',
      [orderNumber]
    );

    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: `Order ${orderNumber} not found`,
      });
    }

    const order = orders[0];
    const oldStatus = order.status;

    // Update order status
    const [result] = await connection.execute(
      'UPDATE orders SET status = ?, updated_at = NOW() WHERE order_number = ?',
      [status, orderNumber]
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Log status change (optional - if you have an order_history table)
    try {
      await connection.execute(
        `INSERT INTO order_history (order_id, old_status, new_status, notes, changed_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [order.id, oldStatus, status, notes || '', req.user.id]
      );
    } catch (historyError) {
      console.warn('Could not log order history:', historyError);
      // Continue even if history logging fails
    }

    await connection.commit();

    res.json({
      success: true,
      message: `Order status updated from ${oldStatus} to ${status} successfully`,
      data: {
        order_number: orderNumber,
        old_status: oldStatus,
        new_status: status,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating order status',
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
};
