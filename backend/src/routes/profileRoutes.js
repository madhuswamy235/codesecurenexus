const express = require('express');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

/** GET /api/auth/profile → alias for /me (kept for client convenience) */
router.get('/profile', protect, (req, res) =>
  res.json({ success: true, data: req.user })
);

module.exports = router;