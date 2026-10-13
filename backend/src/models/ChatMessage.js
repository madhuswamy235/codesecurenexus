const mongoose = require('mongoose');

const ChatMessageSchema = new mongoose.Schema(
  {
    interviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Interview', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    senderName: { type: String, default: '' },
    content: { type: String, required: true },
    type: { type: String, enum: ['text', 'system'], default: 'text' },
  },
  { timestamps: true }
);

module.exports = mongoose.models.ChatMessage || mongoose.model('ChatMessage', ChatMessageSchema);