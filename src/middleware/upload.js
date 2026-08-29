const multer = require('multer');
const path = require('path');
const config = require('../config/config');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'input-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (config.upload.allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('INVALID_IMAGE_FORMAT: Formats autorisés : JPG, JPEG, PNG, WEBP'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: config.upload.maxSize },
  fileFilter: fileFilter
});

module.exports = upload;
