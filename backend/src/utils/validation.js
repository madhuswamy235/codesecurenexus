/**
 * Lightweight validation helpers shared across controllers.
 * Returns an array of human-readable error strings.
 */
function validateEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function validateRegister({ name, email, password }) {
  const errors = [];
  if (!name || !String(name).trim()) errors.push('Name is required');
  if (!email) errors.push('Email is required');
  else if (!validateEmail(email)) errors.push('A valid email is required');
  if (!password || String(password).length < 6) {
    errors.push('Password must be at least 6 characters');
  }
  return errors;
}

module.exports = { validateRegister, validateEmail };