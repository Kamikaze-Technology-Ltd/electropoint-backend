// controllers/categoryController.js
const pool = require('../config/database');
const { generateSlug } = require('../utils/generateId');

// Get all categories
const getCategories = async (req, res) => {
  try {
    const [categories] = await pool.execute(
      'SELECT * FROM categories ORDER BY name'
    );
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get single category
const getCategory = async (req, res) => {
  try {
    const [categories] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [req.params.id]
    );

    if (categories.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(categories[0]);
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create category
const createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Generate slug
    const baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const [existing] = await pool.execute(
        'SELECT id FROM categories WHERE slug = ?',
        [slug]
      );
      if (existing.length === 0) break;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const [result] = await pool.execute(
      'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
      [name, slug, description || null]
    );

    const [newCategory] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json(newCategory[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(400).json({ message: 'Error creating category' });
  }
};

// Update category
const updateCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    const categoryId = req.params.id;

    const [result] = await pool.execute(
      'UPDATE categories SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, description, categoryId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const [updatedCategory] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [categoryId]
    );

    res.json(updatedCategory[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(400).json({ message: 'Error updating category' });
  }
};

// Delete category
const deleteCategory = async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM categories WHERE id = ?', [
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
};
