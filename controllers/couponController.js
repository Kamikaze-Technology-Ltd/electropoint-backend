// controllers/couponController.js
const pool = require('../config/database');

// Get all coupons (admin only)
const getCoupons = async (req, res) => {
  try {
    const [coupons] = await pool.execute(
      'SELECT * FROM coupons ORDER BY created_at DESC'
    );

    res.json({
      success: true,
      data: coupons,
    });
  } catch (error) {
    console.error('Get coupons error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Validate coupon
const validateCoupon = async (req, res) => {
  try {
    const { code, order_amount, orderAmount } = req.query;
    const orderAmountValue = order_amount || orderAmount;
    const currentDate = new Date();

    const [coupons] = await pool.execute(
      `SELECT * FROM coupons 
       WHERE code = ? 
       AND status = 'active'
       AND (valid_from IS NULL OR valid_from <= ?)
       AND (valid_until IS NULL OR valid_until >= ?)`,
      [code, currentDate, currentDate]
    );

    if (coupons.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired coupon',
      });
    }

    const coupon = coupons[0];

    // Convert to numbers for proper comparison
    const orderAmountNum = parseFloat(orderAmountValue) || 0;
    const minOrderAmountNum = parseFloat(coupon.min_order_amount) || 0;

    // Check usage limit
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({
        success: false,
        message: 'Coupon usage limit reached',
      });
    }

    // FIXED: Proper numeric comparison
    if (orderAmountValue && orderAmountNum < minOrderAmountNum) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₦${minOrderAmountNum.toFixed(2)} required`,
      });
    }

    // Calculate discount
    let discount = 0;

    if (coupon.discount_type === 'percentage') {
      discount = (orderAmountNum * coupon.discount_value) / 100;
      if (coupon.max_discount_amount && discount > coupon.max_discount_amount) {
        discount = coupon.max_discount_amount;
      }
    } else {
      discount = coupon.discount_value;
    }

    res.json({
      success: true,
      data: {
        discount: discount,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          discount_type: coupon.discount_type,
          discount_value: coupon.discount_value,
          discount_amount: discount,
          min_order_amount: coupon.min_order_amount,
          max_discount_amount: coupon.max_discount_amount,
        },
      },
    });
  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Create coupon (admin only)
const createCoupon = async (req, res) => {
  try {
    const {
      code,
      discount_type = 'percentage',
      discount_value,
      min_order_amount = 0,
      max_discount_amount,
      usage_limit,
      valid_from,
      valid_until,
    } = req.body;

    // Check if code already exists
    const [existing] = await pool.execute(
      'SELECT id FROM coupons WHERE code = ?',
      [code]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code already exists',
      });
    }

    await pool.execute(
      `INSERT INTO coupons (
        code, discount_type, discount_value, min_order_amount, 
        max_discount_amount, usage_limit, valid_from, valid_until
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code,
        discount_type,
        discount_value,
        min_order_amount,
        max_discount_amount,
        usage_limit,
        valid_from,
        valid_until,
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Coupon created successfully',
    });
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Update coupon (admin only)
const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Define allowed columns
    const allowedColumns = [
      'code',
      'discount_type',
      'discount_value',
      'min_order_amount',
      'max_discount_amount',
      'usage_limit',
      'used_count',
      'valid_from',
      'valid_until',
      'status',
    ];

    // Filter the updates to only allowed columns
    const updateFields = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedColumns.includes(key)) {
        updateFields[key] = value;
      }
    }

    // If there are no fields to update, return an error
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update',
      });
    }

    // Build the SET clause
    const setClause = Object.keys(updateFields)
      .map((key) => `${key} = ?`)
      .join(', ');

    // The values are the updateFields values and then the id
    const values = [...Object.values(updateFields), id];

    const [result] = await pool.execute(
      `UPDATE coupons SET ${setClause} WHERE id = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    res.json({
      success: true,
      message: 'Coupon updated successfully',
    });
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Delete coupon (admin only)
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.execute('DELETE FROM coupons WHERE id = ?', [
      id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Coupon not found',
      });
    }

    res.json({
      success: true,
      message: 'Coupon deleted successfully',
    });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

module.exports = {
  getCoupons,
  validateCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
