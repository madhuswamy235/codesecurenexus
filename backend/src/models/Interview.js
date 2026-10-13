const mongoose = require('mongoose');

const InterviewSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['MCQ', 'CODING', 'LIVE', 'MIXED'],
      default: 'MIXED',
    },
    status: {
      type: String,
      enum: ['draft', 'scheduled', 'active', 'completed', 'cancelled'],
      default: 'draft',
    },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    candidateName: { type: String, default: '' },
    candidateEmail: { type: String, default: '' },
    sessionId: { type: String, default: '' },
    joinToken: { type: String, default: '' },
    currentQuestionIndex: { type: Number, default: 0 },
    currentQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    scheduledAt: { type: Date },
    durationMinutes: { type: Number, default: 60 },
    roomCode: { type: String, default: '' },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Interview || mongoose.model('Interview', InterviewSchema);