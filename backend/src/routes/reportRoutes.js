const express = require('express');
const { getInterviewReport, downloadInterviewReport } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/interview/:interviewId', protect, getInterviewReport);
router.get('/interview/:interviewId/download', protect, downloadInterviewReport);

module.exports = router;