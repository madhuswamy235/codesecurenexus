const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['MCQ', 'CODING', 'WRITTEN', 'FINAL'], required: true },
    // WRITTEN
    answerText: { type: String, default: '' },
    // MCQ
    selectedOption: { type: Number, default: -1 },
    // CODING
    language: { type: String, default: '' },
    code: { type: String, default: '' },
    output: { type: String, default: '' },
    status: {
      type: String,
      enum: ['saved', 'submitted', 'evaluated'],
      default: 'saved',
    },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 10 },
    evaluation: { type: mongoose.Schema.Types.Mixed, default: {} },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Submission || mongoose.model('Submission', SubmissionSchema);
