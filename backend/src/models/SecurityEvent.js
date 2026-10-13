const mongoose = require('mongoose');

const SecurityEventSchema = new mongoose.Schema(
  {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'InterviewSession', default: null },
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', default: null },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    eventType: {
      type: String,
      enum: [
        'CAMERA_STARTED',
        'CAMERA_ENDED',
        'CAMERA_DENIED',
        'CAMERA_ERROR',
        'CAMERA_IDLE',
        'CAMERA_OBSCURED',
        'TAB_SWITCH',
        'TAB_RETURN',
        'WINDOW_BLUR',
        'WINDOW_FOCUS',
        'FULLSCREEN_EXIT',
        'SUSPICIOUS_ACTIVITY',
        'SESSION_STARTED',
        'SESSION_ENDED',
        'PARTICIPANT_JOINED',
        'PARTICIPANT_LEFT',
        'UNEXPECTED_PARTICIPANT',
        'NEARBY_DEVICE_DETECTED',
        'MULTIPLE_FACE_DETECTED',
        'FACE_REVIEW_CONSENT',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW',
    },
    timestamp: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    source: { type: String, default: 'browser' },
  },
  { timestamps: true }
);

SecurityEventSchema.index({ sessionId: 1 });
SecurityEventSchema.index({ interviewId: 1 });
SecurityEventSchema.index({ userId: 1 });
SecurityEventSchema.index({ timestamp: -1 });

module.exports =
  mongoose.models.SecurityEvent || mongoose.model('SecurityEvent', SecurityEventSchema);
