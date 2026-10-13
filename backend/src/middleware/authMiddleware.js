const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const { collection } = require('../storage/storage');

const users = collection('users', User);

/**
 * Protects a route. Verifies the Bearer JWT and attaches req.userId.
 * Also ensures the user still exists and is active.
 */
async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. No token.' });
  }

  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }

  const user = await users.findById(decoded.id).catch(() => null);
  if (!user) {
    return res.status(401).json({ success: false, message: 'User no longer exists.' });
  }
  if (user.isActive === false) {
    return res.status(403).json({ success: false, message: 'Account is deactivated.' });
  }

  req.user = user;
  req.userId = String(user._id || user.id);
  req.userRole = user.role;
  next();
}

module.exports = { protect };
