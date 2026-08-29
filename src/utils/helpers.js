const fs = require('fs');

const deleteFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error(`[Cleanup Error] Impossible de supprimer : ${filePath}`, err.message);
    }
  }
};

const formatError = (code, message) => {
  return {
    success: false,
    error: {
      code: code || 'INTERNAL_ERROR',
      message: message || 'Une erreur interne est survenue.'
    }
  };
};

module.exports = {
  deleteFile,
  formatError
};
