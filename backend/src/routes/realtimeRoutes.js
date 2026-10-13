const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { collection } = require('../storage/storage');
const ChatMessage = require('../models/ChatMessage');
const WhiteboardData = require('../models/WhiteboardData');
const User = require('../models/User');
const { ok, fail } = require('../utils/response');
const { createNotification } = require('../utils/notify');

const router = express.Router();

/* ---------- Chat history ---------- */

/** GET /api/chat/:interviewId/messages — persisted chat history */
router.get('/:interviewId/messages', protect, async (req, res, next) => {
  try {
    const chat = collection('chatmessages', ChatMessage);
    const rows = await chat.find(
      { interviewId: req.params.interviewId },
      { sort: { createdAt: 1 }, limit: 500 }
    );
    return ok(res, rows);
  } catch (err) {
    return next(err);
  }
});

/* ---------- Whiteboard persistence ---------- */

/** GET /api/whiteboard/:interviewId — load saved strokes */
router.get('/:interviewId', protect, async (req, res, next) => {
  try {
    const board = collection('whiteboard', WhiteboardData);
    let row = await board.findOne({ interviewId: req.params.interviewId });
    if (!row) {
      row = await board.insertOne({ interviewId: req.params.interviewId, strokes: [], ops: [], updatedBy: null });
    }
    return ok(res, { strokes: row.strokes || [], ops: row.ops || [] });
  } catch (err) {
    return next(err);
  }
});

/** PUT /api/whiteboard/:interviewId — persist strokes (and ops when supplied) */
router.put('/:interviewId', protect, async (req, res, next) => {
  try {
    const { strokes, ops } = req.body || {};
    const board = collection('whiteboard', WhiteboardData);
    const set = {
      updatedBy: req.userId,
      updatedAt: new Date(),
      ...(strokes !== undefined ? { strokes: Array.isArray(strokes) ? strokes : [] } : {}),
      ...(ops !== undefined ? { ops: Array.isArray(ops) ? ops : [] } : {}),
    };
    let row = await board.findOne({ interviewId: req.params.interviewId });
    if (row) {
      row = await board.updateById(row._id, { $set: set });
    } else {
      row = await board.insertOne({
        interviewId: req.params.interviewId,
        ...(strokes !== undefined ? { strokes: Array.isArray(strokes) ? strokes : [] } : {}),
        ...(ops !== undefined ? { ops: Array.isArray(ops) ? ops : [] } : {}),
        updatedBy: req.userId,
      });
    }
    return ok(res, { strokes: row.strokes || [], ops: row.ops || [] }, 'Whiteboard saved');
  } catch (err) {
    return next(err);
  }
});

/* ---------- Notifications (via socket push later) ---------- */

/** POST /api/notifications/send — create a notification for a user (admin/recruiter) */
router.post('/notifications/send', protect, authorize('admin', 'recruiter'), async (req, res, next) => {
  try {
    const { userId, type, title, message, link } = req.body || {};
    if (!userId || !message) return fail(res, 400, 'userId and message are required');
    const record = await createNotification({ userId, type, title, message, link });
    return ok(res, record, 'Notification sent');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;