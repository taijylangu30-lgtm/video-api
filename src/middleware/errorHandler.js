module.exports = (err, req, res, next) => {
  console.error('API Error:', err.message);

  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';

  if (err.message.startsWith('MAGIC_HOUR_AUTH_ERROR')) {
    statusCode = 401;
    code = 'MAGIC_HOUR_AUTH_ERROR';
  } else if (err.message.startsWith('MAGIC_HOUR_RATE_LIMIT')) {
    statusCode = 429;
    code = 'MAGIC_HOUR_RATE_LIMIT';
  } else if (err.message.startsWith('MAGIC_HOUR_TIMEOUT')) {
    statusCode = 504;
    code = 'MAGIC_HOUR_TIMEOUT';
  } else if (err.message.startsWith('MAGIC_HOUR_API_ERROR')) {
    statusCode = 502;
    code = 'MAGIC_HOUR_API_ERROR';
  } else if (err.message.startsWith('MAGIC_HOUR_INVALID_RESPONSE')) {
    statusCode = 502;
    code = 'MAGIC_HOUR_INVALID_RESPONSE';
  } else if (err.message.startsWith('MAGIC_HOUR_GENERATION_FAILED')) {
    statusCode = 422;
    code = 'MAGIC_HOUR_GENERATION_FAILED';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: code,
      message: err.message.replace(/^[A-Z_]+:\s*/, '')
    }
  });
};
