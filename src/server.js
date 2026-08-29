const app = require('./app');
const config = require('./config/config');

app.listen(config.port, () => {
  console.log(`=================================`);
  console.log(`🚀 Serveur PixVerse API Démarré`);
  console.log(`📡 Port : ${config.port}`);
  console.log(`🌍 Environnement : ${process.env.NODE_ENV || 'development'}`);
  console.log(`=================================`);
});
