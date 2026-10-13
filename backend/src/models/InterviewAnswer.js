const mongoose = require('mongoose');

const InterviewAnswerSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true },
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview' },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    answer: { type: String, default: '' },
    status: { type: String, default: 'submitted' },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.models.InterviewAnswer || mongoose.model('InterviewAnswer', InterviewAnswerSchema);
