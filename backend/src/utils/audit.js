const AuditLog = require('../models/AuditLog');
const { collection, getMode } = require('../storage/storage');

/** Records an audit log entry (persisted via the active storage mode). */
async function writeAudit(req, action, details = {}) {
  try {
    const logs = collection('auditlogs', AuditLog);
    await logs.insertOne({
      userId: req.user ? String(req.user._id || req.user.id) : null,
      email: req.user ? req.user.email : '',
      role: req.user ? req.user.role : 'guest',
      action,
      details,
      ip: req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || '',
      mode: getMode(),
    });
  } catch (err) {
    // Audit logging must never break the main flow.
    console.error('audit write failed', err.message);
  }
}

module.exports = { writeAudit };