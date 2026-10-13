const jwt = require('jsonwebtoken');

// JWT secret must come from the environment. It is never hardcoded so that a
// leaked repo cannot be used to forge tokens. If it is missing we abort early
// with a clear message instead of silently using a weak default.
if (!process.env.JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not set. Add a long random secret to backend/.env (see .env.example).'
  );
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(user) {
  return jwt.sign(
    {
      id: String(user._id || user.id),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = { signToken, verifyToken, JWT_SECRET };