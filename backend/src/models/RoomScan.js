const mongoose = require('mongoose');

const RoomScanSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', required: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: ['CREATED', 'CONSENTED', 'UPLOADED', 'REVIEWED', 'EXPIRED'], default: 'CREATED' },
    consentAcceptedAt: { type: Date, default: null },
    phoneAwayConfirmedAt: { type: Date, default: null },
    phoneAwaySelfReport: { type: Boolean, default: false },
    media: {
      type: [{
        storagePath: String,
        originalName: String,
        mimeType: String,
        size: Number,
        uploadedAt: Date,
      }],
      default: [],
    },
    reviewedAt: { type: Date, default: null },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

RoomScanSchema.index({ interviewId: 1, createdAt: -1 });
RoomScanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.RoomScan || mongoose.model('RoomScan', RoomScanSchema);
