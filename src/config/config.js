const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  pixverse: {
    apiKey: process.env.PIXVERSE_API_KEY || '',
    baseUrl: 'https://api.pixverse.ai/v2'
  },
  upload: {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp']
  }
};
