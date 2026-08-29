const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const videoRoutes = require('./routes/video.routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../public')));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'PixVerse Video API',
    status: 'online'
  });
});

app.use('/api/video', videoRoutes);

app.use(errorHandler);

module.exports = app;
