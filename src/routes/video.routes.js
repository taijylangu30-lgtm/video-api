const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const videoController = require('../controllers/video.controller');

// Configuration du stockage temporaire pour Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Limite 10 Mo
});

// 💡 Vérifiez bien que videoController contient les méthodes correspondantes
router.post('/text', videoController.generateTextToVideo);
router.post('/image', upload.single('image'), videoController.generateImageToVideo);
router.get('/status/:taskId', videoController.getTaskStatus);

module.exports = router;
