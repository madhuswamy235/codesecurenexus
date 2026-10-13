const mongoose = require('mongoose');

const WhiteboardDataSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
    strokes: { type: mongoose.Schema.Types.Mixed, default: [] },
    ops: { type: mongoose.Schema.Types.Mixed, default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.WhiteboardData || mongoose.model('WhiteboardData', WhiteboardDataSchema);