const SecurityEvent = require('../models/SecurityEvent');
const Interview = require('../models/Interview');
const InterviewSession = require('../models/InterviewSession');
const { collection } = require('../storage/storage');
const { ok, created, fail } = require('../utils/response');

const securityEvents = collection('securityevents', SecurityEvent);
const interviews = collection('interviews', Interview);
const sessions = collection('sessions', InterviewSession);

const SEVERITY_BY_EVENT = {
  CAMERA_STARTED: 'LOW',
  CAMERA_ENDED: 'LOW',
  CAMERA_DENIED: 'MEDIUM',
  CAMERA_ERROR: 'MEDIUM',
  CAMERA_IDLE: 'MEDIUM',
  CAMERA_OBSCURED: 'MEDIUM',
  TAB_SWITCH: 'HIGH',
  TAB_RETURN: 'LOW',
  WINDOW_BLUR: 'MEDIUM',
  WINDOW_FOCUS: 'LOW',
  FULLSCREEN_EXIT: 'MEDIUM',
  SUSPICIOUS_ACTIVITY: 'HIGH',
  SESSION_STARTED: 'LOW',
  SESSION_ENDED: 'LOW',
  PARTICIPANT_JOINED: 'LOW',
  PARTICIPANT_LEFT: 'LOW',
  UNEXPECTED_PARTICIPANT: 'HIGH',
  NEARBY_DEVICE_DETECTED: 'MEDIUM',
  MULTIPLE_FACE_DETECTED: 'MEDIUM',
  FACE_REVIEW_CONSENT: 'LOW',
};

const ALLOWED_EVENTS = Object.keys(SEVERITY_BY_EVENT);

function normalizeEventType(eventType) {
  const safe = String(eventType || '').trim();
  return ALLOWED_EVENTS.includes(safe) ? safe : null;
}

function idString(value) {
  if (value === undefined || value === null) return '';
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (typeof value.toHexString === 'function') return value.toHexString();
  if (value._id !== undefined && value._id !== null) return idString(value._id);
  if (value.id !== undefined && value.id !== null && value.id !== value) return idString(value.id);
  return String(value);
}

function shouldEscalateRepeatedTabSwitches(rows, now = new Date()) {
  const start = now.getTime() - 60_000;
  const events = Array.isArray(rows) ? rows : [];
  const recent = events.filter((event) => {
    const at = new Date(event.timestamp || event.createdAt || 0).getTime();
    return event.eventType === 'TAB_SWITCH' && Number.isFinite(at) && at >= start && at <= now.getTime();
  });
  const alreadyWarned = events.some((event) => {
    const at = new Date(event.timestamp || event.createdAt || 0).getTime();
    return event.eventType === 'SUSPICIOUS_ACTIVITY' &&
      event.metadata?.rule === 'repeated-tab-switches' && Number.isFinite(at) && at >= start && at <= now.getTime();
  });
  return recent.length >= 3 && !alreadyWarned ? recent.length : 0;
}

function canAccessSecurityInterview(user, interview, session = null) {
  if (!user || !interview) return false;
  if (user.role === 'admin') return true;

  const userId = idString(user._id || user.id);
  if (!userId) return false;
  const relatedIds = [
    interview.candidateId,
    interview.createdBy,
    interview.recruiterId,
    interview.interviewerId,
    session?.candidateId,
    session?.recruiterId,
  ].map(idString).filter(Boolean);
  if (relatedIds.includes(userId)) return true;

  const hasAssignedCandidate = Boolean(interview.candidateId || session?.candidateId);
  const invitedEmail = String(interview.candidateEmail || session?.candidateEmail || '').trim().toLowerCase();
  const accountEmail = String(user.email || '').trim().toLowerCase();
  return user.role === 'candidate' && !hasAssignedCandidate && Boolean(invitedEmail) && invitedEmail === accountEmail;
}

function normalizeFaceCountDetails(details) {
  const faceCount = details?.faceCount;
  if (typeof faceCount !== 'number' || !Number.isInteger(faceCount) || faceCount < 2 || faceCount > 20) return null;
  return { faceCount };
}

function normalizeNearbyDeviceDetails(details) {
  const rawCount = details?.nearbyDeviceCount;
  if (typeof rawCount !== 'number' || !Number.isInteger(rawCount) || rawCount < 1 || rawCount > 100) return null;
  return { nearbyDeviceCount: rawCount };
}

function summaryFromRows(rows) {
  const deduped = Array.isArray(rows) ? rows : [];
  const byType = {};
  let score = 100;
  let tabSwitchCount = 0;
  let suspiciousActivityCount = 0;
  let unexpectedParticipantCount = 0;
  let nearbyDeviceCount = 0;
  let multipleFaceIncidentCount = 0;
  let cameraIdleCount = 0;
  let cameraDeniedCount = 0;
  let cameraErrorCount = 0;
  let cameraObscuredCount = 0;
  const eventMap = {
    TAB_SWITCH: 5,
    FULLSCREEN_EXIT: 3,
    WINDOW_BLUR: 2,
    CAMERA_DENIED: 10,
    CAMERA_ERROR: 6,
    CAMERA_IDLE: 4,
    CAMERA_OBSCURED: 4,
    SUSPICIOUS_ACTIVITY: 8,
    PARTICIPANT_JOINED: 0,
    PARTICIPANT_LEFT: 0,
    UNEXPECTED_PARTICIPANT: 20,
    TAB_RETURN: 0,
    CAMERA_ENDED: 0,
    FACE_REVIEW_CONSENT: 0,
  };

  for (const event of deduped) {
    const type = normalizeEventType(event.eventType) || event.eventType;
    byType[type] = (byType[type] || 0) + 1;
    if (type === 'TAB_SWITCH') tabSwitchCount += 1;
    if (type === 'SUSPICIOUS_ACTIVITY') suspiciousActivityCount += 1;
    if (type === 'UNEXPECTED_PARTICIPANT') unexpectedParticipantCount += 1;
    if (type === 'MULTIPLE_FACE_DETECTED') multipleFaceIncidentCount += 1;
    if (type === 'CAMERA_IDLE') cameraIdleCount += 1;
    if (type === 'CAMERA_DENIED') cameraDeniedCount += 1;
    if (type === 'CAMERA_ERROR') cameraErrorCount += 1;
    if (type === 'CAMERA_OBSCURED') cameraObscuredCount += 1;
    if (type === 'NEARBY_DEVICE_DETECTED') {
      const count = Math.max(1, Number(event.metadata?.nearbyDeviceCount || event.details?.nearbyDeviceCount) || 1);
      nearbyDeviceCount += count;
      score -= Math.min(30, count * 6);
    } else {
      score -= eventMap[type] || 0;
    }
  }

  score = Math.max(0, Math.min(100, score));
  let securityStatus = 'SAFE';
  if (score < 70) securityStatus = 'HIGH_RISK';
  else if (score < 85) securityStatus = 'WARNING';

  const cameraStatus = deduped.some((event) => event.eventType === 'CAMERA_DENIED')
    ? 'Permission Required'
    : deduped.some((event) => event.eventType === 'CAMERA_ERROR')
      ? 'Error'
      : deduped.some((event) => event.eventType === 'CAMERA_STARTED')
        ? 'Active'
        : 'Unknown';

  return {
    securityScore: score,
    tabSwitchCount,
    suspiciousActivityCount,
    unexpectedParticipantCount,
    nearbyDeviceCount,
    multipleFaceIncidentCount,
    cameraIdleCount,
    cameraDeniedCount,
    cameraErrorCount,
    cameraObscuredCount,
    securityStatus,
    cameraStatus,
    totalEvents: deduped.length,
    byType,
  };
}

async function resolveSecurityContext(user, interviewId, sessionId) {
  let session = sessionId ? await sessions.findById(sessionId) : null;
  const resolvedInterviewId = interviewId || session?.interviewId;
  const interview = resolvedInterviewId ? await interviews.findById(resolvedInterviewId) : null;
  if (!interview) return { error: { status: 404, message: 'Interview not found.' } };
  if (!session) session = await sessions.findOne({ interviewId: interview._id });
  if (!session) return { error: { status: 404, message: 'Interview session not found.' } };
  if (String(session.interviewId) !== String(interview._id)) {
    return { error: { status: 403, message: 'Interview session does not match.' } };
  }
  if (!canAccessSecurityInterview(user, interview, session)) {
    return { error: { status: 403, message: 'You are not allowed to access this interview security data.' } };
  }
  return { interview, session };
}

/** POST /api/security/event — persist and broadcast an authenticated review signal. */
async function createSecurityEvent(req, res, next) {
  try {
    const payload = req.body || {};
    const eventType = normalizeEventType(payload.eventType || payload.type);
    if (!eventType) return fail(res, 400, `eventType must be one of: ${ALLOWED_EVENTS.join(', ')}`);
    if (eventType === 'SUSPICIOUS_ACTIVITY') {
      return fail(res, 403, 'Suspicious-activity alerts are generated by the server after repeated tab-switch signals.');
    }

    const context = await resolveSecurityContext(req.user, payload.interviewId, payload.sessionId);
    if (context.error) return fail(res, context.error.status, context.error.message);
    const { interview, session } = context;

    const incomingDetails = payload.details && typeof payload.details === 'object' && !Array.isArray(payload.details)
      ? payload.details
      : payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
        ? payload.metadata
        : {};
    let details = incomingDetails;
    if (eventType === 'MULTIPLE_FACE_DETECTED') {
      details = normalizeFaceCountDetails(incomingDetails);
      if (!details) return fail(res, 400, 'MULTIPLE_FACE_DETECTED requires an integer faceCount between 2 and 20.');
      if (req.userRole !== 'candidate') return fail(res, 403, 'Only the candidate can report a local face-count event.');
      if (String(session.status).toUpperCase() !== 'ACTIVE') {
        return fail(res, 409, 'Face-count events are only accepted during an active interview.');
      }
    }
    if (eventType === 'NEARBY_DEVICE_DETECTED') {
      details = normalizeNearbyDeviceDetails(incomingDetails);
      if (!details) return fail(res, 400, 'Nearby-device reports require an integer count between 1 and 100.');
      if (req.userRole !== 'candidate') return fail(res, 403, 'Only the candidate can report a local Bluetooth scan.');
    }
    if (eventType === 'FACE_REVIEW_CONSENT') {
      if (req.userRole !== 'candidate') return fail(res, 403, 'Only the candidate can record face-review consent.');
      if (String(session.status).toUpperCase() !== 'ACTIVE') {
        return fail(res, 409, 'Face-review consent is only accepted during an active interview.');
      }
      details = { enabled: incomingDetails.enabled === true, scope: 'local-face-count-only' };
    }

    const now = new Date();
    const source = eventType === 'MULTIPLE_FACE_DETECTED'
      ? 'browser-local-face-count'
      : eventType === 'NEARBY_DEVICE_DETECTED'
        ? 'windows-proximity-companion'
        : 'browser';
    if (eventType === 'NEARBY_DEVICE_DETECTED') {
      const previous = session.deviceIntegrity || {};
      const nearbyDeviceCount = Math.min(
        100,
        (Number(previous.nearbyDeviceCount) || 0) + details.nearbyDeviceCount
      );
      await sessions.updateById(session._id, {
        $set: {
          deviceIntegrity: {
            ...previous,
            proximityStatus: 'detected',
            nearbyDeviceCount,
            checkedAt: now,
          },
        },
      });
    }
    const record = await securityEvents.insertOne({
      sessionId: session._id,
      interviewId: interview._id,
      userId: req.userId,
      eventType,
      severity: SEVERITY_BY_EVENT[eventType],
      timestamp: now,
      metadata: details,
      details,
      source,
    });
    const eventsToBroadcast = [record];

    if (eventType === 'TAB_SWITCH') {
      const recentEvents = await securityEvents.find(
        { sessionId: session._id },
        { sort: { timestamp: -1 }, limit: 50 }
      );
      const tabSwitchCount = shouldEscalateRepeatedTabSwitches(recentEvents, now);
      if (tabSwitchCount) {
        const warning = await securityEvents.insertOne({
          sessionId: session._id,
          interviewId: interview._id,
          userId: req.userId,
          eventType: 'SUSPICIOUS_ACTIVITY',
          severity: 'HIGH',
          timestamp: now,
          metadata: { rule: 'repeated-tab-switches', tabSwitchCount, windowSeconds: 60 },
          details: { rule: 'repeated-tab-switches', tabSwitchCount, windowSeconds: 60 },
          source: 'server-tab-switch-heuristic',
        });
        eventsToBroadcast.push(warning);
      }
    }

    try {
      const io = req.app?.get('io');
      for (const event of eventsToBroadcast) {
        io?.to(`interview:${String(interview._id)}`).emit('security-event', {
          ...event,
          interviewId: String(interview._id),
          sessionId: String(session._id),
          userId: req.userId,
          byId: req.userId,
          byName: req.user?.name || 'Participant',
          timestamp: event.timestamp || now,
        });
      }
    } catch {
      // Persistence succeeds independently if the realtime transport is offline.
    }
    return created(res, record, 'Security event recorded');
  } catch (err) {
    return next(err);
  }
}

/** GET /api/security/interview/:interviewId — authorized interview timeline. */
async function getInterviewSecurityEvents(req, res, next) {
  try {
    const context = await resolveSecurityContext(req.user, req.params.interviewId, null);
    if (context.error) return fail(res, context.error.status, context.error.message);
    const rows = await securityEvents.find(
      { interviewId: context.interview._id },
      { sort: { createdAt: -1 }, limit: 500 }
    );
    return ok(res, rows);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/security/events/:sessionId — authorized session timeline. */
async function getSessionSecurityEvents(req, res, next) {
  try {
    const context = await resolveSecurityContext(req.user, null, req.params.sessionId);
    if (context.error) return fail(res, context.error.status, context.error.message);
    const rows = await securityEvents.find(
      { sessionId: context.session._id },
      { sort: { createdAt: -1 }, limit: 500 }
    );
    return ok(res, rows);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/security/summary?interviewId=... or ?sessionId=... */
async function getSecuritySummary(req, res, next) {
  try {
    const { interviewId, sessionId } = { ...req.query, ...req.params };
    if (!interviewId && !sessionId) return fail(res, 400, 'interviewId or sessionId is required.');
    const context = await resolveSecurityContext(req.user, interviewId, sessionId);
    if (context.error) return fail(res, context.error.status, context.error.message);
    const rows = await securityEvents.find(
      sessionId ? { sessionId: context.session._id } : { interviewId: context.interview._id },
      { sort: { createdAt: 1 }, limit: 1000 }
    );
    return ok(res, summaryFromRows(rows));
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createSecurityEvent,
  getInterviewSecurityEvents,
  getSessionSecurityEvents,
  getSecuritySummary,
  summaryFromRows,
  normalizeEventType,
  normalizeFaceCountDetails,
  normalizeNearbyDeviceDetails,
  canAccessSecurityInterview,
  shouldEscalateRepeatedTabSwitches,
};
