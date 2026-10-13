const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview' },
    type: { type: String, enum: ['MCQ', 'CODING', 'WRITTEN'], required: true },
    text: { type: String, required: true },
    options: { type: [String], default: [] }, // MCQ choices
    correctOption: { type: Number, default: -1 }, // index in options
    language: { type: String, default: 'javascript' }, // coding
    starterCode: { type: String, default: '' },
    testCases: [
      {
        input: String,
        expected: String,
      },
    ],
    maxScore: { type: Number, default: 10 },
    tags: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Question || mongoose.model('Question', QuestionSchema);
