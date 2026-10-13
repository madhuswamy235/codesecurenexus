/**
 * Central API response helpers.
 * Every controller returns this consistent envelope so the frontend
 * can rely on a single response shape: { success, data?, message? }
 */
function ok(res, data, message) {
  return res.json({
    success: true,
    data,
    message: message || 'Success',
  });
}

function created(res, data, message) {
  return res.status(201).json({
    success: true,
    data,
    message: message || 'Created successfully',
  });
}

function fail(res, status, message, errors) {
  return res.status(status).json({
    success: false,
    message,
    errors,
  });
}

module.exports = { ok, created, fail };