const { formatError } = require('../utils/helpers');

const errorHandler = (err, req, res, next) => {
  console.error('[API Error]:', err.message);

  if (err.message && err.message.startsWith('INVALID_IMAGE_FORMAT')) {
    return res.status(400).json(formatError('INVALID_IMAGE_FORMAT', err.message.split(': ')[1]));
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(formatError('IMAGE_TOO_LARGE', 'L\'image dépasse la taille maximale autorisée de 10 Mo.'));
  }

  return res.status(500).json(formatError('SERVER_ERROR', err.message || 'Erreur interne du serveur.'));
};

module.exports = errorHandler;
