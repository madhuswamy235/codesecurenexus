const express = require('express');
const { register, login, logout, me, updatePassword, checkEmail } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { rateLimit } = require('express-rate-limit');

const router = express.Router();

// Simple login/register rate limiter. The limit must comfortably fit the
// automated integration suites (phase2a/2b/3 are run back-to-back and issue
// ~12 auth calls within one minute) while still blocking brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, slow down.' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/check-email', checkEmail);
router.get('/me', protect, me);
router.put('/password', protect, updatePassword);
router.post('/logout', protect, logout);

module.exports = router;
