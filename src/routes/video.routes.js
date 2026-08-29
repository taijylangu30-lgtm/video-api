const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const videoController = require('../controllers/video.controller');
const upload = require('../middleware/upload');

const generateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Trop de demandes de génération. Réessayez dans 15 minutes.'
    }
  }
});

router.post('/text', generateLimiter, videoController.textToVideo);
router.post('/image', generateLimiter, upload.single('image'), videoController.imageToVideo);
router.get('/status/:taskId', videoController.getStatus);

module.exports = router;
