const mongoose = require('mongoose');

const EvaluationSchema = new mongoose.Schema(
  {
    technicalScore: Number,
    relevanceScore: Number,
    communicationScore: Number,
    confidenceScore: Number,
    overallScore: Number,
    strengths: [String],
    weaknesses: [String],
    feedback: String,
    mode: String,
  },
  { _id: false }
);

const QuestionSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    question: { type: String, required: true },
    category: { type: String, required: true },
    answer: { type: String, default: '' },
    evaluation: { type: EvaluationSchema, default: null },
  },
  { _id: false }
);

const AIInterviewSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    role: { type: String, default: 'Software Engineer' },
    difficulty: { type: String, default: 'Medium' },
    topics: { type: [String], default: [] },
    mode: { type: String, enum: ['PRACTICE', 'INTERVIEW'], default: 'PRACTICE' },
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    questions: { type: [QuestionSchema], default: [] },
    startedAt: { type: Date, default: Date.now },
    endedAt: Date,
    finalScore: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.AIInterviewSession || mongoose.model('AIInterviewSession', AIInterviewSessionSchema);