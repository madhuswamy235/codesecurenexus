const crypto = require('crypto');
const Interview = require('../models/Interview');
const InterviewSession = require('../models/InterviewSession');
const SecurityEvent = require('../models/SecurityEvent');
const User = require('../models/User');
const { collection } = require('../storage/storage');
const { ok, created, fail } = require('../utils/response');
const { writeAudit } = require('../utils/audit');

const interviews = collection('interviews', Interview);
const sessions = collection('sessions', InterviewSession);
const securityEvents = collection('securityevents', SecurityEvent);
const users = collection('users', User);

function newRoomCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

/** GET /api/interviews/invite/:token — safe preview for an invitation link. */
async function getPublicInvite(req, res, next) {
  try {
    const token = String(req.params.token || '');
    const session =
      (await sessions.findOne({ joinToken: token })) ||
      (await sessions.findOne({ sessionId: token }));
    if (!session) return fail(res, 404, 'Interview invitation not found');

    const interview = await interviews.findById(session.interviewId).catch(() => null);
    if (!interview) return fail(res, 404, 'Interview invitation not found');

    if (
      ['completed', 'cancelled'].includes(String(interview.status).toLowerCase()) ||
      ['ENDED', 'CANCELLED'].includes(String(session.status))
    ) {
      return fail(res, 409, 'This interview has ended or been cancelled');
    }

    const recruiter = interview.recruiterId
      ? await users.findById(interview.recruiterId)
      : null;

    return ok(res, {
      interview: {
        _id: String(interview._id),
        title: interview.title,
        type: interview.type,
        status: interview.status,
        candidateName: interview.candidateName || '',
        scheduledAt: interview.scheduledAt || null,
        durationMinutes: interview.durationMinutes,
        recruiter: recruiter ? { name: recruiter.name } : null,
      },
      session: {
        _id: String(session._id),
        sessionId: session.sessionId,
        status: session.status,
        startedAt: session.startedAt || null,
        deviceIntegrity: session.deviceIntegrity || null,
      },
    });
  } catch (err) {
    return next(err);
  }
}

function makeUniqueSessionId() {
  return `int_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

async function ensureUniqueSessionId() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = makeUniqueSessionId();
    const existing = await sessions.findOne({ sessionId: candidate });
    if (!existing) return candidate;
  }
  return `int_${Date.now()}${String(Math.random()).slice(2, 10)}`;
}

async function attachPeople(rows) {
  const result = [];
  for (const row of rows) {
    const candidate = row.candidateId ? await users.findById(row.candidateId) : null;
    const interviewer = row.interviewerId ? await users.findById(row.interviewerId) : null;
    const recruiter = row.recruiterId ? await users.findById(row.recruiterId) : null;
    result.push({
      ...row,
      candidate: candidate
        ? { _id: candidate._id, name: candidate.name, email: candidate.email }
        : null,
      interviewer: interviewer ? { _id: interviewer._id, name: interviewer.name, email: interviewer.email } : null,
      recruiter: recruiter ? { _id: recruiter._id, name: recruiter.name, email: recruiter.email } : null,
    });
  }
  return result;
}

/** GET /api/interviews?status=&search= — role aware */
async function listInterviews(req, res, next) {
  try {
    const { status, search } = req.query || {};
    const query = {};
    if (status) query.status = status;

    let rows;
    if (req.userRole === 'admin') {
      rows = await interviews.find(query, { sort: { createdAt: -1 } });
    } else {
      const assignedFieldByRole = {
        candidate: 'candidateId',
        interviewer: 'interviewerId',
        recruiter: 'recruiterId',
      };
      const assignedField = assignedFieldByRole[req.userRole];
      const [assignedRows, createdRows] = await Promise.all([
        assignedField
          ? interviews.find({ ...query, [assignedField]: req.userId }, { sort: { createdAt: -1 } })
          : Promise.resolve([]),
        interviews.find({ ...query, createdBy: req.userId }, { sort: { createdAt: -1 } }),
      ]);
      rows = [...new Map([...assignedRows, ...createdRows].map((row) => [String(row._id || row.id), row])).values()];
      rows.sort((left, right) => {
        const leftTime = Date.parse(left.createdAt || '') || 0;
        const rightTime = Date.parse(right.createdAt || '') || 0;
        return rightTime - leftTime;
      });
    }
    if (search) {
      const s = String(search).toLowerCase();
      rows = rows.filter((it) => (it.title || '').toLowerCase().includes(s));
    }
    return ok(res, await attachPeople(rows));
  } catch (err) {
    return next(err);
  }
}

/** POST /api/interviews — create for any authenticated account */
async function createInterview(req, res, next) {
  try {
    const {
      title, description, type, candidateId, interviewerId, candidateName, candidateEmail,
      scheduledAt, durationMinutes, tags, status, questions,
    } = req.body || {};

    if (!title || !String(title).trim()) return fail(res, 400, 'title is required');
    const allowedTypes = ['MCQ', 'CODING', 'LIVE', 'MIXED'];
    if (type && !allowedTypes.includes(type)) return fail(res, 400, 'Invalid interview type');

    const recruiterId = req.userRole === 'candidate'
      ? null
      : req.userRole === 'recruiter' ? req.userId : req.userRole === 'admin' && req.body.recruiterId
        ? req.body.recruiterId
        : req.userId;

    const candidateEmailValue = (candidateEmail || '').toString().trim();
    let candidateRecord = null;
    if (candidateEmailValue) {
      candidateRecord = await users.findOne({ email: candidateEmailValue.toLowerCase() });
    }

    const effectiveCandidateId = candidateId || (candidateRecord ? String(candidateRecord._id || candidateRecord.id) : null);

    const allowedStatuses = ['draft', 'scheduled', 'active', 'completed', 'cancelled'];
    const requestedStatus = status && allowedStatuses.includes(status) ? status : null;
    const effectiveStatus = requestedStatus || (!effectiveCandidateId && !scheduledAt ? 'draft' : 'scheduled');

    const interview = await interviews.insertOne({
      title: String(title).trim(),
      description: description || '',
      type: type || 'MIXED',
      status: effectiveStatus,
      candidateId: effectiveCandidateId || null,
      candidateName: candidateName || candidateRecord?.name || '',
      candidateEmail: candidateEmailValue || candidateRecord?.email || '',
      interviewerId: interviewerId || null,
      recruiterId,
      createdBy: req.userId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      durationMinutes: Number(durationMinutes) || 60,
      roomCode: newRoomCode(),
      sessionId: '',
      joinToken: '',
      currentQuestionIndex: 0,
      currentQuestionId: null,
      tags: Array.isArray(tags) ? tags : [],
    });

    const session = await ensureInterviewSession(interview);
    const joinToken = session.joinToken || makeJoinToken();
    const sessionId = session.sessionId || await ensureUniqueSessionId();
    await sessions.updateById(session._id, {
      $set: {
        sessionId,
        joinToken,
        recruiterId: interview.recruiterId || recruiterId,
        candidateId: effectiveCandidateId || session.candidateId || null,
        candidateName: interview.candidateName || candidateName || '',
        candidateEmail: interview.candidateEmail || candidateEmailValue || '',
        status: 'WAITING_FOR_CANDIDATE',
      },
    });
    await interviews.updateById(interview._id, {
      $set: {
        sessionId,
        joinToken,
        candidateName: interview.candidateName || candidateName || '',
        candidateEmail: interview.candidateEmail || candidateEmailValue || '',
      },
    });

    const baseUrl = (process.env.APP_BASE_URL || process.env.FRONTEND_URL || 'http://localhost:3000')
      .split(',')
      .map((value) => String(value).trim())
      .find(Boolean) || 'http://localhost:3000';
    const joinLink = `${baseUrl.replace(/\/$/, '')}/interview/join/${encodeURIComponent(joinToken)}`;

    await writeAudit(req, 'interview.create', { interviewId: interview._id, title: interview.title, sessionId });
    return created(res, {
      ...interview,
      sessionId,
      joinToken,
      joinLink,
      sessionStatus: 'WAITING_FOR_CANDIDATE',
      status: 'WAITING_FOR_CANDIDATE',
      questions: Array.isArray(questions) ? questions : [],
      candidate: candidateRecord ? { _id: candidateRecord._id, name: candidateRecord.name, email: candidateRecord.email } : null,
    }, 'Interview created');
  } catch (err) {
    return next(err);
  }
}

/** GET /api/interviews/:id */
async function getInterview(req, res, next) {
  try {
    const interview = await interviews.findById(req.params.id);
    if (!interview) return fail(res, 404, 'Interview not found');
    const enriched = await attachPeople([interview]);
    const session = await sessions.findOne({ interviewId: req.params.id });
    return ok(res, { ...enriched[0], session });
  } catch (err) {
    return next(err);
  }
}

/** PUT /api/interviews/:id */
async function updateInterview(req, res, next) {
  try {
    const { title, description, type, candidateId, interviewerId, scheduledAt, durationMinutes, status, tags } = req.body || {};
    const set = {};
    if (title !== undefined) set.title = String(title).trim();
    if (description !== undefined) set.description = description;
    if (type !== undefined) set.type = type;
    if (candidateId !== undefined) set.candidateId = candidateId;
    if (interviewerId !== undefined) set.interviewerId = interviewerId;
    if (scheduledAt !== undefined) set.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (durationMinutes !== undefined) set.durationMinutes = Number(durationMinutes);
    if (status !== undefined) set.status = status;
    if (tags !== undefined) set.tags = Array.isArray(tags) ? tags : [];

    const updated = await interviews.updateById(req.params.id, { $set: set });
    if (!updated) return fail(res, 404, 'Interview not found');
    await writeAudit(req, 'interview.update', { interviewId: req.params.id });
    return ok(res, updated, 'Interview updated');
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/interviews/:id */
async function deleteInterview(req, res, next) {
  try {
    const removed = await interviews.deleteById(req.params.id);
    if (!removed) return fail(res, 404, 'Interview not found');
    await sessions.deleteMany({ interviewId: req.params.id });
    await writeAudit(req, 'interview.delete', { interviewId: req.params.id });
    return ok(res, null, 'Interview deleted');
  } catch (err) {
    return next(err);
  }
}

/* ============ INTERVIEW SESSION MANAGEMENT ============ */

async function ensureSession(interviewId, userId) {
  let session = await sessions.findOne({ interviewId });
  if (!session) {
    const nextSessionId = await ensureUniqueSessionId();
    session = await sessions.insertOne({
      interviewId,
      sessionId: nextSessionId,
      status: 'CREATED',
      startedAt: null,
      endedAt: null,
      timerSecondsRemaining: 0,
      totalSeconds: 0,
      activeParticipants: 0,
      recruiterId: userId || null,
      createdBy: userId,
    });
  }
  return session;
}

function makeJoinToken() {
  return `int_${crypto.randomBytes(32).toString('hex')}`;
}

async function ensureInterviewSession(interview) {
  let session = await sessions.findOne({ interviewId: interview._id });
  if (!session) {
    const token = makeJoinToken();
    const nextSessionId = await ensureUniqueSessionId();
    session = await sessions.insertOne({
      interviewId: interview._id,
      sessionId: nextSessionId,
      recruiterId: interview.recruiterId || null,
      candidateId: interview.candidateId || null,
      candidateName: interview.candidateName || '',
      candidateEmail: interview.candidateEmail || '',
      status: 'CREATED',
      joinToken: token,
      currentQuestionIndex: 0,
      currentQuestionId: null,
      currentQuestion: '',
      questionNumber: 0,
      questionStatus: 'PENDING',
      startedAt: null,
      endedAt: null,
      timerSecondsRemaining: 0,
      totalSeconds: 0,
      activeParticipants: 0,
    });
  }
  return session;
}

async function resolveInterviewSession(identifier) {
  const interviewById = await interviews.findById(identifier).catch(() => null);
  if (interviewById) {
    const session = await sessions.findOne({ interviewId: interviewById._id });
    return { interview: interviewById, session };
  }

  const sessionById = await sessions.findOne({ sessionId: identifier });
  if (sessionById) {
    const interview = await interviews.findById(sessionById.interviewId).catch(() => null);
    return { interview, session: sessionById };
  }

  const sessionByToken = await sessions.findOne({ joinToken: identifier });
  if (sessionByToken) {
    const interview = await interviews.findById(sessionByToken.interviewId).catch(() => null);
    return { interview, session: sessionByToken };
  }

  return { interview: null, session: null };
}

function canAccessInterview(user, interview, session = null) {
  if (!user || !interview) return false;
  if (user.role === 'admin') return true;
  const uid = String(user._id || user.id || '');
  if (!uid) return false;

  const candidateMatch = interview.candidateId && String(interview.candidateId) === uid;
  const creatorMatch = interview.createdBy && String(interview.createdBy) === uid;
  const recruiterMatch = interview.recruiterId && String(interview.recruiterId) === uid;
  const interviewerMatch = interview.interviewerId && String(interview.interviewerId) === uid;

  if (candidateMatch || creatorMatch || recruiterMatch || interviewerMatch) return true;
  if (session) {
    return (
      (session.candidateId && String(session.candidateId) === uid) ||
      (session.recruiterId && String(session.recruiterId) === uid)
    );
  }
  return false;
}

/** GET /api/interviews/:id/session */
async function getSession(req, res, next) {
  try {
    const { interview, session } = await resolveInterviewSession(req.params.id);
    if (!interview || !session) return fail(res, 404, 'Interview session not found');
    if (!canAccessInterview(req.user, interview, session)) {
      return fail(res, 403, 'You are not allowed to access this interview session');
    }

    const endedOrCancelled = ['completed', 'cancelled'].includes(String(interview.status).toLowerCase()) ||
      ['ENDED', 'CANCELLED'].includes(String(session.status));
    if (endedOrCancelled) {
      return fail(res, 409, 'This interview has ended or been cancelled');
    }

    return ok(res, { interview, session });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/interviews/:id/start — creates/activates session, marks interview live */
async function startInterview(req, res, next) {
  try {
    const { interview, session } = await resolveInterviewSession(req.params.id);
    if (!interview || !session) return fail(res, 404, 'Interview session not found');
    if (!['admin', 'recruiter', 'interviewer'].includes(req.userRole)) {
      return fail(res, 403, 'Only the recruiter or interviewer can start this interview');
    }
    if (!canAccessInterview(req.user, interview, session)) {
      return fail(res, 403, 'You are not allowed to start this interview');
    }

    const startedAt = session.startedAt || new Date();
    const nextSession = await sessions.updateById(session._id, {
      $set: {
        status: 'ACTIVE',
        startedAt,
        endedAt: null,
        timerSecondsRemaining:
          Number(req.body.timerSeconds) || Number(interview.durationMinutes) * 60 || 3600,
      },
    });

    await interviews.updateById(interview._id, { $set: { status: 'active' } });
    await writeAudit(req, 'interview.start', { interviewId: interview._id });

    return ok(res, { interview, session: nextSession || { ...session, status: 'ACTIVE', startedAt } }, 'Interview started');
  } catch (err) {
    return next(err);
  }
}

/** POST /api/interviews/:id/join — returns active/pending session for the room */
async function joinInterview(req, res, next) {
  try {
    const { interview, session } = await resolveInterviewSession(req.params.id);
    if (!interview || !session) return fail(res, 404, 'Interview session not found');
    if (req.userRole === 'candidate') {
      const assignedCandidateId = interview.candidateId || session.candidateId;
      const invitedEmail = String(interview.candidateEmail || session.candidateEmail || '').trim().toLowerCase();
      const candidateEmail = String(req.user.email || '').trim().toLowerCase();
      if (assignedCandidateId && String(assignedCandidateId) !== req.userId) {
        return fail(res, 403, 'This invitation belongs to a different candidate account');
      }
      if (!assignedCandidateId && (!invitedEmail || candidateEmail !== invitedEmail)) {
        return fail(res, 403, 'Sign in with the email address that received this invitation');
      }
      if (!assignedCandidateId) {
        await interviews.updateById(interview._id, {
          $set: { candidateId: req.userId, candidateName: req.user.name || interview.candidateName },
        });
        await sessions.updateById(session._id, {
          $set: { candidateId: req.userId, candidateName: req.user.name || session.candidateName },
        });
        interview.candidateId = req.userId;
        session.candidateId = req.userId;
      }
    }
    if (!canAccessInterview(req.user, interview, session)) {
      return fail(res, 403, 'You are not allowed to join this interview');
    }
    if (['completed', 'cancelled'].includes(String(interview.status).toLowerCase()) || ['ENDED', 'CANCELLED'].includes(String(session.status))) {
      return fail(res, 409, 'This interview has already ended or been cancelled');
    }

    let deviceIntegrity = session.deviceIntegrity || null;
    if (req.userRole === 'candidate') {
      const deviceId = String(req.body?.deviceId || '');
      if (!/^[0-9a-f-]{36}$/i.test(deviceId)) {
        return fail(res, 400, 'A browser device identifier is required to join');
      }
      if (session.candidateDeviceId && session.candidateDeviceId !== deviceId) {
        await securityEvents.insertOne({
          sessionId: session._id,
          interviewId: interview._id,
          userId: req.userId,
          eventType: 'UNEXPECTED_PARTICIPANT',
          severity: 'HIGH',
          source: 'device-binding',
          metadata: { reason: 'candidate-device-mismatch' },
          details: {},
        });
        return fail(res, 409, 'This interview is already bound to another browser device');
      }

      const rawCount = Number(req.body?.nearbyDeviceCount);
      const nearbyDeviceCount = Number.isFinite(rawCount)
        ? Math.max(0, Math.min(100, Math.floor(rawCount)))
        : 0;
      const proximityStatus = ['detected', 'none', 'unsupported', 'denied', 'error', 'not-run']
        .includes(req.body?.proximityStatus)
        ? req.body.proximityStatus
        : 'not-run';
      const previousIntegrity = session.deviceIntegrity || {};
      deviceIntegrity = {
        ...previousIntegrity,
        browserBound: true,
        proximityStatus: nearbyDeviceCount > 0
          ? 'detected'
          : proximityStatus === 'not-run' && previousIntegrity.proximityStatus
            ? previousIntegrity.proximityStatus
            : proximityStatus,
        nearbyDeviceCount: Math.max(Number(previousIntegrity.nearbyDeviceCount) || 0, nearbyDeviceCount),
        checkedAt: new Date(),
      };

      if (nearbyDeviceCount > 0) {
        await securityEvents.insertOne({
          sessionId: session._id,
          interviewId: interview._id,
          userId: req.userId,
          eventType: 'NEARBY_DEVICE_DETECTED',
          severity: 'MEDIUM',
          source: 'browser-bluetooth',
          metadata: { nearbyDeviceCount, proximityStatus },
          details: {},
        });
      }
    }

    const nextStatus = ['CREATED', 'WAITING_FOR_CANDIDATE'].includes(session.status)
      ? 'READY'
      : session.status;
    const nextSession = await sessions.updateById(session._id, {
      $set: {
        status: nextStatus,
        startedAt: session.startedAt || (nextStatus === 'ACTIVE' ? new Date() : null),
        ...(req.userRole === 'candidate'
          ? { candidateDeviceId: String(req.body.deviceId), deviceIntegrity }
          : {}),
      },
    });

    await writeAudit(req, 'interview.join', { interviewId: interview._id });
    return ok(res, { interview, session: nextSession || { ...session, status: nextStatus } }, 'Joined interview');
  } catch (err) {
    return next(err);
  }
}

/** POST /api/interviews/:id/end — completes the session */
async function endInterview(req, res, next) {
  try {
    const { interview, session } = await resolveInterviewSession(req.params.id);
    if (!interview || !session) return fail(res, 404, 'Interview session not found');
    if (!['admin', 'recruiter', 'interviewer'].includes(req.userRole)) {
      return fail(res, 403, 'Only the recruiter or interviewer can end this interview');
    }
    if (!canAccessInterview(req.user, interview, session)) {
      return fail(res, 403, 'You are not allowed to end this interview');
    }

    const endedAt = new Date();
    const totalSeconds = session && session.startedAt
      ? Math.round((endedAt - new Date(session.startedAt)) / 1000)
      : 0;

    const nextSession = session ? await sessions.updateById(session._id, {
      $set: { status: 'ENDED', endedAt, totalSeconds },
    }) : null;
    await interviews.updateById(interview._id, { $set: { status: 'completed' } });
    await writeAudit(req, 'interview.end', { interviewId: interview._id, totalSeconds });

    return ok(res, { interview: await interviews.findById(interview._id), session: nextSession || { ...session, status: 'ENDED', endedAt, totalSeconds } }, 'Interview ended');
  } catch (err) {
    return next(err);
  }
}

/** POST /api/interviews/:id/cancel — stops and cancels the session. */
async function cancelInterview(req, res, next) {
  try {
    const { interview, session } = await resolveInterviewSession(req.params.id);
    if (!interview || !session) return fail(res, 404, 'Interview session not found');
    if (!['admin', 'recruiter'].includes(req.userRole)) {
      return fail(res, 403, 'Only the recruiter can cancel this interview');
    }
    if (!canAccessInterview(req.user, interview, session)) {
      return fail(res, 403, 'You are not allowed to cancel this interview');
    }

    const cancelledAt = new Date();
    const nextSession = session ? await sessions.updateById(session._id, {
      $set: { status: 'CANCELLED', endedAt: cancelledAt },
    }) : null;
    await interviews.updateById(interview._id, { $set: { status: 'cancelled' } });
    await writeAudit(req, 'interview.cancel', { interviewId: interview._id });

    return ok(res, {
      interview: await interviews.findById(interview._id),
      session: nextSession || { ...session, status: 'CANCELLED', endedAt: cancelledAt },
    }, 'Interview cancelled');
  } catch (err) {
    return next(err);
  }
}

/** POST /api/interviews/:id/device/reset — allows a recruiter to rebind a candidate device. */
async function resetCandidateDevice(req, res, next) {
  try {
    const { interview, session } = await resolveInterviewSession(req.params.id);
    if (!interview || !session) return fail(res, 404, 'Interview session not found');
    if (!['admin', 'recruiter'].includes(req.userRole) || !canAccessInterview(req.user, interview, session)) {
      return fail(res, 403, 'Only the assigned recruiter can reset the candidate device');
    }
    if (['ENDED', 'CANCELLED'].includes(session.status)) {
      return fail(res, 409, 'A device cannot be reset after the interview has ended');
    }

    const updated = await sessions.updateById(session._id, {
      $set: { candidateDeviceId: '', deviceIntegrity: null },
    });
    await writeAudit(req, 'interview.device.reset', { interviewId: interview._id });
    return ok(res, { interview, session: updated }, 'Candidate device binding reset');
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listInterviews,
  createInterview,
  getInterview,
  updateInterview,
  deleteInterview,
  getSession,
  getPublicInvite,
  startInterview,
  joinInterview,
  endInterview,
  cancelInterview,
  resetCandidateDevice,
};
