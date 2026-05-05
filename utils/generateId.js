function generateUniqueId(name) {
  // Convert name to slug format: "Samsung Galaxy S23" -> "samsung-galaxy-s23"
  const slug = name
    .toLowerCase()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '-');

  // Add timestamp for uniqueness
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);

  return `${slug}-${timestamp}-${random}`;
}

function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '') // Remove invalid chars
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/-+/g, '-') // Replace multiple - with single -
    .trim();
}

function generateOrderId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `ORD-${timestamp}-${random}`;
}

module.exports = { generateUniqueId, generateOrderId, generateSlug };
