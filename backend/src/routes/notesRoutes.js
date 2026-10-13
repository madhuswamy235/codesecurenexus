const express = require('express');
const { createNote, getInterviewNotes, updateNote, deleteNote } = require('../controllers/notesController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, createNote);
router.get('/interview/:interviewId', protect, getInterviewNotes);
router.put('/:id', protect, updateNote);
router.delete('/:id', protect, deleteNote);

module.exports = router;