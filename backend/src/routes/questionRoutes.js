const express = require('express');
const {
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
} = require('../controllers/questionController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/', protect, listQuestions);
router.post('/', protect, authorize('admin', 'recruiter', 'interviewer'), createQuestion);
router.put('/:id', protect, authorize('admin', 'recruiter', 'interviewer'), updateQuestion);
router.delete('/:id', protect, authorize('admin', 'recruiter', 'interviewer'), deleteQuestion);

module.exports = router;