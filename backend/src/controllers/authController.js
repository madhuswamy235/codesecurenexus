const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { collection, getMode } = require('../storage/storage');
const { signToken } = require('../utils/jwt');
const { ok, created, fail } = require('../utils/response');
const { validateRegister, validateEmail } = require('../utils/validation');
const { writeAudit } = require('../utils/audit');

const users = collection('users', User);

/** Removes the password hash from any user object before sending to clients. */
function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  void password;
  return safe;
}

/* Public registration always creates candidates; privileged roles must be provisioned securely. */
async function register(req, res, next) {
  try {
    const { name, email, password, mobile } = req.body || {};

    const errors = validateRegister({ name, email, password });
    if (errors.length) return fail(res, 400, 'Validation failed', errors);

    const existing = await users.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) return fail(res, 409, 'An account with this email already exists');

    const hash = await bcrypt.hash(String(password), 10);

    const user = await users.insertOne({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password: hash,
      role: 'candidate',
      mobile: mobile || '',
      profileImage: '',
      skills: [],
      isActive: true,
    });

    if (!user) return fail(res, 500, 'Registration failed');

    const token = signToken(user);
    await writeAudit(req, 'user.register', { userId: user._id, email: user.email, role: user.role });

    return created(res, { token, user: sanitizeUser(user) }, 'Registration successful');
  } catch (err) {
    return next(err);
  }
}

/* Logs a user in and returns a JWT. */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return fail(res, 400, 'Email and password are required');

    const user = await users.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return fail(res, 401, 'Invalid credentials');

    const valid = await bcrypt.compare(String(password), user.password || '');
    if (!valid) return fail(res, 401, 'Invalid credentials');
    if (user.isActive === false) return fail(res, 403, 'Account is deactivated');

    const token = signToken(user);
    await writeAudit(req, 'user.login', { userId: user._id, email: user.email });

    return ok(
      res,
      { token, user: sanitizeUser(user), storageMode: getMode() },
      'Login successful'
    );
  } catch (err) {
    return next(err);
  }
}

/* Stateless logout — the client discards the token. We just audit it. */
async function logout(req, res, next) {
  try {
    if (req.user) await writeAudit(req, 'user.logout', { userId: req.user._id });
    return ok(res, null, 'Logged out successfully');
  } catch (err) {
    return next(err);
  }
}

/* Returns the authenticated user profile. */
async function me(req, res, next) {
  try {
    const user = await users.findById(req.userId);
    if (!user) return fail(res, 404, 'User not found');
    return ok(res, sanitizeUser(user), 'Profile loaded');
  } catch (err) {
    return next(err);
  }
}

/* Changes password for the authenticated user. */
async function updatePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return fail(res, 400, 'currentPassword and newPassword are required');
    }
    if (String(newPassword).length < 6) {
      return fail(res, 400, 'New password must be at least 6 characters');
    }

    const user = await users.findById(req.userId);
    if (!user) return fail(res, 404, 'User not found');

    const valid = await bcrypt.compare(String(currentPassword), user.password || '');
    if (!valid) return fail(res, 400, 'Current password is incorrect');

    const hash = await bcrypt.hash(String(newPassword), 10);
    await users.updateById(req.userId, { $set: { password: hash } });
    await writeAudit(req, 'user.password_changed', { userId: req.userId });

    return ok(res, null, 'Password updated successfully');
  } catch (err) {
    return next(err);
  }
}

/* Quick email check helper used by the frontend during sign-up. */
async function checkEmail(req, res, next) {
  try {
    const { email } = req.body || {};
    if (!email || !validateEmail(email)) return fail(res, 400, 'A valid email is required');
    const existing = await users.findOne({ email: String(email).toLowerCase().trim() });
    return ok(res, { available: !existing }, existing ? 'Email already registered' : 'Email available');
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, logout, me, updatePassword, checkEmail, sanitizeUser };
