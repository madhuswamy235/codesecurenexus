const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const controller = require('../controllers/aiInterviewController');

const router = express.Router();
router.use(protect);
router.post('/start', controller.start);
router.post('/next-question', controller.nextQuestion);
router.post('/evaluate', controller.evaluate);
router.get('/report/:sessionId', controller.report);
module.exports = router;