const express = require('express');
const {
  listSubmissions,
  getSubmission,
  saveMcq,
  submitMcq,
  saveCode,
  runCode,
  submitCode,
  saveWritten,
  submitWritten,
  submitFinal,
} = require('../controllers/submissionController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Submission retrieval
router.get('/', protect, listSubmissions);
router.get('/:id', protect, getSubmission);

// MCQ assessment
router.post('/mcq/save', protect, saveMcq);
router.post('/mcq/submit', protect, submitMcq);

// Coding assessment
router.post('/code/save', protect, saveCode);
router.post('/code/run', protect, runCode);
router.post('/code/submit', protect, submitCode);

// Written assessment
router.post('/written/save', protect, saveWritten);
router.post('/written/submit', protect, submitWritten);


// Combined final assessment submission
router.post('/final/submit', protect, submitFinal);

module.exports = router;
