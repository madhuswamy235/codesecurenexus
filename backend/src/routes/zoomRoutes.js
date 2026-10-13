const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { signature } = require('../controllers/zoomController');

const router = express.Router();
router.post('/signature', protect, signature);
module.exports = router;