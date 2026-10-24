const express = require('express');
const {
  listInterviews,
  createInterview,
  getInterview,
  updateInterview,
  deleteInterview,
  getPublicInvite,
  getSession,
  startInterview,
  joinInterview,
  endInterview,
  cancelInterview,
  resetCandidateDevice,
} = require('../controllers/interviewController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

const router = express.Router();

// Keep the invite route before /:id so it is matched as a public preview.
router.get('/invite/:token', getPublicInvite);

// CRUD
router.get('/', protect, listInterviews);
router.post('/', protect, authorize('admin', 'recruiter', 'interviewer'), createInterview);
router.get('/:id', protect, getInterview);
router.put('/:id', protect, authorize('admin', 'recruiter', 'interviewer'), updateInterview);
router.delete('/:id', protect, authorize('admin', 'recruiter'), deleteInterview);

// Session management
router.get('/:id/session', protect, getSession);
router.post('/:id/start', protect, startInterview);
router.post('/:id/join', protect, joinInterview);
router.post('/:id/end', protect, endInterview);
router.post('/:id/cancel', protect, cancelInterview);
router.post('/:id/device/reset', protect, resetCandidateDevice);

module.exports = router;
