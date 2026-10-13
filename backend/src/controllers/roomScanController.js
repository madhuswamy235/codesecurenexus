const crypto = require('crypto');
const path = require('path');
const Interview = require('../models/Interview');
const InterviewSession = require('../models/InterviewSession');
const RoomScan = require('../models/RoomScan');
const { collection } = require('../storage/storage');
const { ok, created, fail } = require('../utils/response');
const { ROOM_SCAN_DIR } = require('../middleware/roomScanUpload');

const interviews = collection('interviews', Interview);
const sessions = collection('sessions', InterviewSession);
const roomScans = collection('roomscans', RoomScan);

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function tokenExpiry(scan) {
  return new Date(scan.expiresAt).getTime() <= Date.now();
}

function canReview(req, interview) {
  if (!req.user || !interview) return false;
  if (req.userRole === 'admin') return true;
  const id = String(req.userId);
  return ['recruiter', 'interviewer'].includes(req.userRole) &&
    [interview.recruiterId, interview.interviewerId, interview.createdBy].some((value) => String(value || '') === id);
}

async function createRoomScanToken(req, res, next) {
  try {
    const interview = await interviews.findById(req.params.interviewId);
    if (!interview) return fail(res, 404, 'Interview not found');
    if (!canReview(req, interview)) return fail(res, 403, 'You are not allowed to create a room-scan link');
    const session = await sessions.findOne({ interviewId: interview._id });
    if (!session) return fail(res, 404, 'Interview session not found');

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + (Number(process.env.ROOM_SCAN_TOKEN_TTL_MINUTES) || 20) * 60 * 1000);
    await roomScans.insertOne({
      interviewId: interview._id,
      sessionId: session._id,
      tokenHash: hashToken(token),
      expiresAt,
      status: 'CREATED',
      media: [],
    });
    await sessions.updateById(session._id, { $set: { roomScanStatus: 'CREATED' } });
    const baseUrl = (process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].replace(/\/$/, '');
    return created(res, { token, expiresAt, url: `${baseUrl}/interview/room-scan/${encodeURIComponent(token)}` }, 'Room-scan link created');
  } catch (err) { return next(err); }
}

async function findTokenScan(token) {
  return roomScans.findOne({ tokenHash: hashToken(token) });
}

async function getRoomScanByToken(req, res, next) {
  try {
    const scan = await findTokenScan(req.params.token);
    if (!scan || tokenExpiry(scan)) return fail(res, 404, 'This room-scan link is invalid or expired');
    const interview = await interviews.findById(scan.interviewId);
    return ok(res, { interview: { _id: String(interview?._id || ''), title: interview?.title || '', candidateName: interview?.candidateName || '' }, expiresAt: scan.expiresAt, status: scan.status, consentAccepted: Boolean(scan.consentAcceptedAt), uploadedCount: scan.media?.length || 0 });
  } catch (err) { return next(err); }
}

async function submitRoomScan(req, res, next) {
  try {
    const scan = await findTokenScan(req.params.token);
    if (!scan || tokenExpiry(scan)) return fail(res, 404, 'This room-scan link is invalid or expired');
    if (String(req.body?.consentAccepted) !== 'true') return fail(res, 400, 'Candidate consent is required before uploading a room scan');
    if (!req.files?.length) return fail(res, 400, 'Upload at least one room video or image');
    const now = new Date();
    const media = req.files.map((file) => ({ storagePath: file.path, originalName: file.originalname, mimeType: file.mimetype, size: file.size, uploadedAt: now }));
    const updated = await roomScans.updateById(scan._id, { $set: {
      status: 'UPLOADED', consentAcceptedAt: scan.consentAcceptedAt || now,
      phoneAwayConfirmedAt: String(req.body?.phoneAwayConfirmed) === 'true' ? now : null,
      phoneAwaySelfReport: String(req.body?.phoneAwayConfirmed) === 'true', media,
    } });
    await sessions.updateById(scan.sessionId, { $set: { roomScanStatus: 'UPLOADED', roomScanCompletedAt: now } });
    return created(res, { scanId: String(updated?._id || scan._id), status: 'UPLOADED', phoneAwaySelfReport: String(req.body?.phoneAwayConfirmed) === 'true' }, 'Room scan uploaded for recruiter review');
  } catch (err) { return next(err); }
}

async function listRoomScans(req, res, next) {
  try {
    const interview = await interviews.findById(req.params.interviewId);
    if (!interview) return fail(res, 404, 'Interview not found');
    if (!canReview(req, interview)) return fail(res, 403, 'You are not allowed to review this room scan');
    const rows = await roomScans.find({ interviewId: interview._id }, { sort: { createdAt: -1 }, limit: 20 });
    return ok(res, rows.map((row) => ({ ...row, media: (row.media || []).map((item, index) => ({ index, originalName: item.originalName, mimeType: item.mimeType, size: item.size, uploadedAt: item.uploadedAt })) })));
  } catch (err) { return next(err); }
}

async function streamRoomScanMedia(req, res, next) {
  try {
    const scan = await roomScans.findById(req.params.scanId);
    const interview = scan ? await interviews.findById(scan.interviewId) : null;
    if (!scan || !interview || !canReview(req, interview)) return res.status(404).json({ success: false, message: 'Room-scan media not found' });
    const item = scan.media?.[Number(req.params.index)];
    if (!item?.storagePath || path.dirname(item.storagePath) !== ROOM_SCAN_DIR) return res.status(404).end();
    return res.sendFile(item.storagePath, { headers: { 'Content-Disposition': `inline; filename="${path.basename(item.originalName || 'room-scan')}"` } }, next);
  } catch (err) { return next(err); }
}

async function markRoomScanReviewed(req, res, next) {
  try {
    const scan = await roomScans.findById(req.params.scanId);
    const interview = scan ? await interviews.findById(scan.interviewId) : null;
    if (!scan || !interview || !canReview(req, interview)) return fail(res, 404, 'Room scan not found');
    const updated = await roomScans.updateById(scan._id, { $set: { status: 'REVIEWED', reviewedAt: new Date(), reviewedBy: req.userId } });
    return ok(res, updated, 'Room scan marked reviewed');
  } catch (err) { return next(err); }
}

module.exports = { createRoomScanToken, getRoomScanByToken, submitRoomScan, listRoomScans, streamRoomScanMedia, markRoomScanReviewed, hashToken, tokenExpiry };
