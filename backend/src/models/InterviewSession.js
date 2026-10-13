const mongoose = require('mongoose');

const InterviewSessionSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
    sessionId: { type: String, default: '' },
    recruiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    candidateName: { type: String, default: '' },
    candidateEmail: { type: String, default: '' },
    status: {
      type: String,
      enum: ['CREATED', 'WAITING_FOR_CANDIDATE', 'READY', 'ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED'],
      default: 'CREATED',
    },
    joinToken: { type: String, default: '' },
    candidateDeviceId: { type: String, default: '' },
    deviceIntegrity: { type: mongoose.Schema.Types.Mixed, default: null },
    currentQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    currentQuestionIndex: { type: Number, default: 0 },
    currentQuestion: { type: String, default: '' },
    questionNumber: { type: Number, default: 0 },
    questionStatus: { type: String, default: '' },
    startedAt: { type: Date },
    endedAt: { type: Date },
    timerSecondsRemaining: { type: Number, default: 0 },
    totalSeconds: { type: Number, default: 0 },
    activeParticipants: { type: Number, default: 0 },
    roomScanStatus: { type: String, enum: ['NOT_REQUESTED', 'CREATED', 'UPLOADED', 'REVIEWED'], default: 'NOT_REQUESTED' },
    roomScanCompletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.InterviewSession || mongoose.model('InterviewSession', InterviewSessionSchema);
