const express = require('express');
const {
  createSecurityEvent,
  getInterviewSecurityEvents,
  getSessionSecurityEvents,
  getSecuritySummary,
} = require('../controllers/securityController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/event', protect, createSecurityEvent);
router.post('/events', protect, createSecurityEvent);
router.get('/summary', protect, getSecuritySummary);
router.get('/summary/:sessionId', protect, getSecuritySummary);
router.get('/events/:sessionId', protect, getSessionSecurityEvents);
router.get('/interview/:interviewId', protect, getInterviewSecurityEvents);

module.exports = router;