// middleware/upload.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const productStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'electropoint/products',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ quality: 'auto', fetch_format: 'auto' }],
  },
});

const receiptStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'electropoint/receipts',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'],
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

upload.receipt = multer({
  storage: receiptStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

module.exports = upload;
