const express = require('express');
const { status, analyze, summarize, analyzeSecurity } = require('../controllers/aiController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/status', protect, status);
router.post('/analyze-response', protect, analyze);
router.post('/summarize-interview', protect, summarize);
router.post('/security/analyze', protect, analyzeSecurity);

module.exports = router;