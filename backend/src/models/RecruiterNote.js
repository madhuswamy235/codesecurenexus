const mongoose = require('mongoose');

const RecruiterNoteSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.RecruiterNote || mongoose.model('RecruiterNote', RecruiterNoteSchema);