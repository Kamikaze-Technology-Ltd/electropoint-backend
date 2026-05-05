// controllers/productController.js
const pool = require("../config/database");
const upload = require("../middleware/upload");
const { generateSlug } = require("../utils/generateId");

// Helper function to get product with images
const getProductWithImages = async (productId) => {
  const [productRows] = await pool.execute(
    `SELECT p.*, 
            c.name as category_name, 
            c.slug as category_slug,
            u.first_name, 
            u.last_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN users u ON p.vendor_id = u.id
     WHERE p.id = ?`,
    [productId],
  );

  if (productRows.length === 0) return null;

  const product = productRows[0];

  // Get product images
  const [imageRows] = await pool.execute(
    "SELECT image_url FROM product_images WHERE product_id = ?",
    [productId],
  );

  product.images = imageRows.map((row) => row.image_url);
  return product;
};

// Get all products with filtering
// const getProducts = async (req, res) => {
//   try {
//     const {
//       page = 1,
//       limit = 10,
//       category,
//       featured,
//       best_seller,
//       flash_sale,
//       new_arrival,
//       search,
//     } = req.query;

//     let whereClause = 'WHERE p.status = "active"';
//     const params = [];

//     if (category) {
//       whereClause += ' AND p.category_slug = ?';
//       params.push(category);
//     }
//     if (featured === 'true') {
//       whereClause += ' AND p.featured = true';
//     }
//     if (best_seller === 'true') {
//       whereClause += ' AND p.best_seller = true';
//     }
//     if (flash_sale === 'true') {
//       whereClause += ' AND p.flash_sale = true';
//     }
//     if (new_arrival === 'true') {
//       whereClause += ' AND p.new_arrival = true';
//     }
//     if (search) {
//       whereClause += ' AND (p.name LIKE ? OR p.description LIKE ?)';
//       const searchTerm = `%${search}%`;
//       params.push(searchTerm, searchTerm);
//     }

//     const offset = (page - 1) * limit;

//     // Get products
//     const [products] = await pool.execute(
//       `SELECT p.*,
//               c.name as category_name,
//               c.slug as category_slug,
//               u.first_name,
//               u.last_name
//        FROM products p
//        LEFT JOIN categories c ON p.category_id = c.id
//        LEFT JOIN users u ON p.vendor_id = u.id
//        ${whereClause}
//        ORDER BY p.created_at DESC
//        LIMIT ? OFFSET ?`,
//       [...params, parseInt(limit), offset]
//     );

//     // Get total count
//     const [countRows] = await pool.execute(
//       `SELECT COUNT(*) as total FROM products p ${whereClause}`,
//       params
//     );

//     // Get images for each product
//     for (let product of products) {
//       const [images] = await pool.execute(
//         'SELECT image_url FROM product_images WHERE product_id = ?',
//         [product.id]
//       );
//       product.images = images.map((img) => img.image_url);
//     }

//     res.json({
//       products,
//       totalPages: Math.ceil(countRows[0].total / limit),
//       currentPage: parseInt(page),
//       total: countRows[0].total,
//     });
//   } catch (error) {
//     console.error('Error fetching products:', error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };
const getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      featured,
      best_seller,
      flash_sale,
      new_arrival,
      search,
      min_price, // Added min_price
      max_price, // Added max_price
      sort, // Added sort parameter
    } = req.query;

    let whereClause = 'WHERE p.status = "active"';
    const params = [];

    if (category) {
      whereClause += " AND p.category_slug = ?";
      params.push(category);
    }
    if (featured === "true") {
      whereClause += " AND p.featured = true";
    }
    if (best_seller === "true") {
      whereClause += " AND p.best_seller = true";
    }
    if (flash_sale === "true") {
      whereClause += " AND p.flash_sale = true";
    }
    if (new_arrival === "true") {
      whereClause += " AND p.new_arrival = true";
    }
    if (search) {
      whereClause += " AND (p.name LIKE ? OR p.description LIKE ?)";
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    if (min_price) {
      whereClause += " AND p.sale_price >= ?";
      params.push(parseFloat(min_price));
    }
    if (max_price) {
      whereClause += " AND p.sale_price <= ?";
      params.push(parseFloat(max_price));
    }

    const offset = (page - 1) * limit;

    // Handle sorting
    let orderByClause = "ORDER BY p.created_at DESC"; // default
    if (sort) {
      switch (sort) {
        case "newest":
          orderByClause = "ORDER BY p.created_at DESC";
          break;
        case "price_asc":
          orderByClause = "ORDER BY p.sale_price ASC";
          break;
        case "price_desc":
          orderByClause = "ORDER BY p.sale_price DESC";
          break;
        case "name_asc":
          orderByClause = "ORDER BY p.name ASC";
          break;
        case "name_desc":
          orderByClause = "ORDER BY p.name DESC";
          break;
        case "popular":
          orderByClause = "ORDER BY p.sales_count DESC";
          break;
        default:
          orderByClause = "ORDER BY p.created_at DESC";
      }
    }

    // Get products
    const [products] = await pool.execute(
      `SELECT p.*, 
              c.name as category_name, 
              c.slug as category_slug,
              u.first_name, 
              u.last_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN users u ON p.vendor_id = u.id
       ${whereClause}
       ${orderByClause}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset],
    );

    // Get total count
    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM products p ${whereClause}`,
      params,
    );

    // Get images for each product
    for (let product of products) {
      const [images] = await pool.execute(
        "SELECT image_url FROM product_images WHERE product_id = ?",
        [product.id],
      );
      product.images = images.map((img) => img.image_url);
    }

    console.log("This is over here");
    console.log(products);
    console.log(category);

    res.json({
      products,
      totalPages: Math.ceil(countRows[0].total / limit),
      currentPage: parseInt(page),
      total: countRows[0].total,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get featured products
const getFeaturedProducts = async (req, res) => {
  try {
    const [products] = await pool.execute(
      `SELECT p.*, 
              c.name as category_name, 
              c.slug as category_slug,
              u.first_name, 
              u.last_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN users u ON p.vendor_id = u.id
       WHERE p.featured = true AND p.status = 'active' AND p.category_slug != 'adult-toys'
       ORDER BY RAND()
       LIMIT 16`,
    );

    // Get images for each product
    for (let product of products) {
      const [images] = await pool.execute(
        "SELECT image_url FROM product_images WHERE product_id = ?",
        [product.id],
      );
      product.images = images.map((img) => img.image_url);
    }

    res.json(products);
  } catch (error) {
    console.error("Error fetching featured products:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get best selling products
const getBestProducts = async (req, res) => {
  try {
    const [products] = await pool.execute(
      `SELECT p.*, 
              c.name as category_name, 
              c.slug as category_slug,
              u.first_name, 
              u.last_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN users u ON p.vendor_id = u.id
       WHERE p.status = 'active' AND p.category_slug != 'adult-toys'
       ORDER BY RAND()
       LIMIT 16`,
    );

    // Get images for each product
    for (let product of products) {
      const [images] = await pool.execute(
        "SELECT image_url FROM product_images WHERE product_id = ?",
        [product.id],
      );
      product.images = images.map((img) => img.image_url);
    }

    res.json(products);
  } catch (error) {
    console.error("Error fetching best products:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get flash sale products
const getFlashSaleProducts = async (req, res) => {
  try {
    const [products] = await pool.execute(
      `SELECT p.*, 
              c.name as category_name, 
              c.slug as category_slug,
              u.first_name, 
              u.last_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN users u ON p.vendor_id = u.id
       WHERE p.flash_sale = true AND p.status = 'active' AND p.category_slug != 'adult-toys'
       ORDER BY RAND()
       LIMIT 16`,
    );

    // Get images for each product
    for (let product of products) {
      const [images] = await pool.execute(
        "SELECT image_url FROM product_images WHERE product_id = ?",
        [product.id],
      );
      product.images = images.map((img) => img.image_url);
    }

    res.json(products);
  } catch (error) {
    console.error("Error fetching flash sale products:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get new arrival products
const getNewArrivals = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [products] = await pool.execute(
      `SELECT p.*, 
              c.name as category_name, 
              c.slug as category_slug,
              u.first_name, 
              u.last_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN users u ON p.vendor_id = u.id
       WHERE p.created_at >= ? AND p.status = 'active' AND p.category_slug != 'adult-toys'
       ORDER BY RAND()
       LIMIT 16`,
      [thirtyDaysAgo],
    );

    // Get images for each product
    for (let product of products) {
      const [images] = await pool.execute(
        "SELECT image_url FROM product_images WHERE product_id = ?",
        [product.id],
      );
      product.images = images.map((img) => img.image_url);
    }

    res.json(products);
  } catch (error) {
    console.error("Error fetching new arrivals:", error);
    res.status(500).json({ message: "Server error" });
  }
};
const createProduct = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      name,
      description,
      price,
      sale_price,
      category_id,
      stock,
      discount,
      data,
    } = req.body;

    const [categoryRows] = await connection.execute(
      "SELECT * FROM categories WHERE id = ?",
      [category_id],
    );

    if (categoryRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Category not found" });
    }

    const category = categoryRows[0];

    const baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const [existing] = await connection.execute(
        "SELECT id FROM products WHERE slug = ?",
        [slug],
      );
      if (existing.length === 0) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    let calculatedDiscount = discount;
    if (sale_price && !discount) {
      calculatedDiscount = Math.round(((price - sale_price) / price) * 100);
    }

    // Insert product with status defaulting to inactive
    const [result] = await connection.execute(
      `INSERT INTO products (
        name, slug, description, price, sale_price, category_id, 
        category_slug, stock, discount, vendor_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        slug,
        description,
        price,
        sale_price || null,
        category_id,
        category.slug,
        stock,
        calculatedDiscount || 0,
        req.user.id,
        "inactive", // requires admin activation before going live
      ],
    );

    const productId = result.insertId;

    if (req.files && req.files.length > 0) {
      const imageValues = req.files.map((file) => [
        productId,
        `/uploads/${file.filename}`,
      ]);

      await connection.query(
        "INSERT INTO product_images (product_id, image_url) VALUES ?",
        [imageValues],
      );
    }

    await connection.commit();

    const product = await getProductWithImages(productId);
    res.status(201).json(product);
  } catch (error) {
    await connection.rollback();
    console.error("Error creating product:", error);
    res.status(400).json({ message: "Error creating product" });
  } finally {
    connection.release();
  }
};
// Get single product by slug
const getProduct = async (req, res) => {
  try {
    const [productRows] = await pool.execute(
      `SELECT p.*, 
              c.name as category_name, 
              c.slug as category_slug,
              u.first_name, 
              u.last_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN users u ON p.vendor_id = u.id
       WHERE p.slug = ? AND p.status = 'active'`,
      [req.params.slug],
    );

    if (productRows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = productRows[0];

    // Get product images
    const [images] = await pool.execute(
      "SELECT image_url FROM product_images WHERE product_id = ?",
      [product.id],
    );

    product.images = images.map((img) => img.image_url);

    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Update product
const updateProduct = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const productId = req.params.id;

    // Check if product exists and user has permission
    const [productRows] = await connection.execute(
      "SELECT * FROM products WHERE id = ?",
      [productId],
    );

    if (productRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ message: "Product not found" });
    }

    const product = productRows[0];

    if (req.user.role !== "admin" && product.vendor_id !== req.user.id) {
      await connection.rollback();
      return res.status(403).json({ message: "Not authorized" });
    }

    // Update best_seller status based on sales count
    const updates = { ...req.body };
    if (updates.sales_count !== undefined) {
      updates.best_seller = updates.sales_count >= 50;
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    Object.keys(updates).forEach((key) => {
      if (key !== "images" && updates[key] !== undefined) {
        updateFields.push(`${key} = ?`);
        updateValues.push(updates[key]);
      }
    });

    if (updateFields.length > 0) {
      updateValues.push(productId);
      await connection.execute(
        `UPDATE products SET ${updateFields.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        updateValues,
      );
    }

    // Handle image updates if provided
    if (req.files && req.files.length > 0) {
      // Delete existing images
      await connection.execute(
        "DELETE FROM product_images WHERE product_id = ?",
        [productId],
      );

      // Insert new images
      const imageValues = req.files.map((file) => [
        productId,
        `/uploads/${file.filename}`,
      ]);

      await connection.query(
        "INSERT INTO product_images (product_id, image_url) VALUES ?",
        [imageValues],
      );
    }

    await connection.commit();

    // Get updated product
    const updatedProduct = await getProductWithImages(productId);
    res.json(updatedProduct);
  } catch (error) {
    await connection.rollback();
    console.error("Error updating product:", error);
    res.status(400).json({ message: "Error updating product" });
  } finally {
    connection.release();
  }
};

// Set product as featured
const setFeatured = async (req, res) => {
  try {
    const [result] = await pool.execute(
      "UPDATE products SET featured = ? WHERE id = ?",
      [req.body.featured, req.params.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = await getProductWithImages(req.params.id);
    res.json(product);
  } catch (error) {
    console.error("Error updating featured status:", error);
    res.status(400).json({ message: "Error updating product" });
  }
};

// Set product for flash sale
const setFlashSale = async (req, res) => {
  try {
    const [result] = await pool.execute(
      "UPDATE products SET flash_sale = ? WHERE id = ?",
      [req.body.flash_sale, req.params.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = await getProductWithImages(req.params.id);
    res.json(product);
  } catch (error) {
    console.error("Error updating flash sale status:", error);
    res.status(400).json({ message: "Error updating product" });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    // Check if product exists and user has permission
    const [productRows] = await pool.execute(
      "SELECT * FROM products WHERE id = ?",
      [productId],
    );

    if (productRows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = productRows[0];

    if (req.user.role !== "admin" && product.vendor_id !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    await pool.execute("DELETE FROM products WHERE id = ?", [productId]);
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Search products
const searchProducts = async (req, res) => {
  try {
    const { q, category } = req.query;

    let whereClause = 'WHERE p.status = "active"';
    const params = [];

    if (q) {
      whereClause += " AND (p.name LIKE ? OR p.description LIKE ?)";
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm);
    }

    if (category) {
      whereClause += " AND p.category_slug = ?";
      params.push(category);
    }

    const [products] = await pool.execute(
      `SELECT p.*, 
              c.name as category_name, 
              c.slug as category_slug,
              u.first_name, 
              u.last_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN users u ON p.vendor_id = u.id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT 20`,
      params,
    );

    // Get images for each product
    for (let product of products) {
      const [images] = await pool.execute(
        "SELECT image_url FROM product_images WHERE product_id = ?",
        [product.id],
      );
      product.images = images.map((img) => img.image_url);
    }

    res.json(products);
  } catch (error) {
    console.error("Error searching products:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get products by category
const getProductsByCategory = async (req, res) => {
  try {
    const [products] = await pool.execute(
      `SELECT p.*, 
              c.name as category_name, 
              c.slug as category_slug,
              u.first_name, 
              u.last_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN users u ON p.vendor_id = u.id
       WHERE p.category_slug = ? AND p.status = 'active'
       ORDER BY p.created_at DESC`,
      [req.params.categorySlug],
    );

    // Get images for each product
    for (let product of products) {
      const [images] = await pool.execute(
        "SELECT image_url FROM product_images WHERE product_id = ?",
        [product.id],
      );
      product.images = images.map((img) => img.image_url);
    }

    res.json(products);
  } catch (error) {
    console.error("Error fetching category products:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const getProductsByStatus = async (req, res) => {
  const VALID_STATUSES = ["active", "inactive"];
  const status = req.query.status || "active";

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  try {
    const [products] = await pool.execute(
      `SELECT p.*, 
              c.name as category_name, 
              c.slug as category_slug,
              u.first_name, 
              u.last_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN users u ON p.vendor_id = u.id
       WHERE p.status = ?
       ORDER BY p.created_at DESC`,
      [status],
    );

    for (let product of products) {
      const [images] = await pool.execute(
        "SELECT image_url FROM product_images WHERE product_id = ?",
        [product.id],
      );
      product.images = images.map((img) => img.image_url);
    }

    res.json(products);
  } catch (error) {
    console.error(`Error fetching ${status} products:`, error);
    res.status(500).json({ message: "Server error" });
  }
};

const updateProductStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const VALID_STATUSES = ["active", "inactive"];

  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  try {
    const [product] = await pool.execute(
      "SELECT id FROM products WHERE id = ?",
      [id],
    );

    if (product.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    await pool.execute(
      "UPDATE products SET status = ?, updated_at = NOW() WHERE id = ?",
      [status, id],
    );

    const [updatedProduct] = await pool.execute(
      "SELECT * FROM products WHERE id = ?",
      [id],
    );

    res.json({
      message: `Product successfully ${status === "active" ? "activated" : "deactivated"}`,
      product: updatedProduct[0],
    });
  } catch (error) {
    console.error("Error updating product status:", error);
    res.status(500).json({ message: "Server error" });
  }
};

const submitPaymentReceipt = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const { full_name, phone, state, city, address, zip_code } = req.body;

    // ── Validate required fields ───────────────────────────────────────────
    if (!full_name || !phone || !state || !city || !address) {
      await connection.rollback();
      return res
        .status(400)
        .json({ message: "Please fill in all required fields" });
    }

    // ── Validate receipt file (mirrors req.files check in createProduct) ───
    if (!req.file) {
      await connection.rollback();
      return res
        .status(400)
        .json({ message: "Please upload a payment receipt" });
    }

    const receiptUrl = `/uploads/${req.file.filename}`;

    // ── Insert linked to logged-in user (mirrors vendor_id → req.user.id) ──
    const [result] = await connection.execute(
      `INSERT INTO payment_receipts (
        user_id,
        full_name,
        phone,
        state,
        city,
        address,
        zip_code,
        receipt_url,
        status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, // linked to authenticated user — same pattern as vendor_id in createProduct
        full_name,
        phone,
        state,
        city,
        address,
        zip_code || null,
        receiptUrl,
        "pending", // admin verifies → 'verified' or 'rejected'
      ],
    );

    const receiptId = result.insertId;

    // ── Fetch created record to return (same pattern as getProductWithImages)
    const [rows] = await connection.execute(
      `SELECT 
        pr.*,
        u.first_name,
        u.last_name,
        u.email
       FROM payment_receipts pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.id = ?`,
      [receiptId],
    );

    await connection.commit();

    res.status(201).json({
      success: true,
      message: "Payment receipt submitted. We will verify within 2–4 hours.",
      data: rows[0],
    });
  } catch (error) {
    await connection.rollback();
    console.error("Error submitting payment receipt:", error);
    res.status(400).json({
      message: "Error submitting payment receipt",
      error: error.message,
    });
  } finally {
    connection.release();
  }
};

const getPaymentReceipts = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    if (status && status !== "all") {
      conditions.push("pr.status = ?");
      params.push(status);
    }

    const whereClause =
      conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

    const [receipts] = await pool.query(
      `SELECT
        pr.*,
        u.first_name,
        u.last_name,
        u.email
       FROM payment_receipts pr
       JOIN users u ON pr.user_id = u.id
       ${whereClause}
       ORDER BY pr.created_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      params,
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM payment_receipts pr ${whereClause}`,
      params,
    );

    res.json({
      receipts,
      total: countRows[0].total,
      currentPage: pageNum,
      totalPages: Math.ceil(countRows[0].total / limitNum),
    });
  } catch (error) {
    console.error("Error fetching payment receipts:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ── UPDATE payment receipt status (admin only) ────────────────────────────────
const updatePaymentReceiptStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const VALID_STATUSES = ["pending", "verified", "rejected"];
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const [existing] = await pool.query(
      "SELECT id FROM payment_receipts WHERE id = ?",
      [id],
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: "Payment receipt not found" });
    }

    await pool.query(
      "UPDATE payment_receipts SET status = ?, admin_notes = ?, updated_at = NOW() WHERE id = ?",
      [status, admin_notes || null, id],
    );

    const [updated] = await pool.query(
      `SELECT pr.*, u.first_name, u.last_name, u.email
       FROM payment_receipts pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.id = ?`,
      [id],
    );

    res.json({
      success: true,
      message: `Payment receipt ${status}`,
      data: updated[0],
    });
  } catch (error) {
    console.error("Error updating payment receipt status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = {
  getProducts,
  getProduct,
  createProduct: [upload.array("images", 5), createProduct],
  updateProduct: [upload.array("images", 5), updateProduct],
  deleteProduct,
  getFeaturedProducts,
  getBestProducts,
  getFlashSaleProducts,
  getNewArrivals,
  searchProducts,
  getProductsByCategory,
  setFeatured,
  setFlashSale,
  getProductsByStatus,
  updateProductStatus,
  submitPaymentReceipt: [upload.single("receipt"), submitPaymentReceipt],
  updatePaymentReceiptStatus,
  getPaymentReceipts,
};
