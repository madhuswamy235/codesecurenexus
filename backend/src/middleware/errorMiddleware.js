const logger = require('../utils/logger');

/** 404 handler for unmatched routes. */
function notFound(req, res, next) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

/** Centralized error handler. */
function errorHandler(err, req, res, next) {
  logger.error('💥 Error:', err.message || err);
  if (err.stack) logger.error(err.stack);

  const status = err.status || err.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    errors: err.errors || undefined,
  });
}

module.exports = { notFound: notFound, errorHandler }; // eslint-disable-line