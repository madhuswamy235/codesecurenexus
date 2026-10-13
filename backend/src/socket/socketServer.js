const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const Interview = require('../models/Interview');
const InterviewSession = require('../models/InterviewSession');
const ChatMessage = require('../models/ChatMessage');
const WhiteboardData = require('../models/WhiteboardData');
const SecurityEvent = require('../models/SecurityEvent');
const { collection } = require('../storage/storage');
const { createNotification } = require('../utils/notify');
const logger = require('../utils/logger');

const users = collection('users', User);
const interviews = collection('interviews', Interview);
const sessions = collection('sessions', InterviewSession);
const chat = collection('chatmessages', ChatMessage);
const board = collection('whiteboard', WhiteboardData);
const securityEvents = collection('securityevents', SecurityEvent);

/* ---------------------------------------------------------------------------
 * Small validation helpers.
 * ------------------------------------------------------------------------- */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
function str(v, max) {
  const s = typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v);
  return s.slice(0, max);
}
function capPoints(points, max = 4000) {
  if (!Array.isArray(points)) return [];
  const out = [];
  for (const p of points) {
    if (isPlainObject(p) && isNum(p.x) && isNum(p.y)) {
      out.push({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
      if (out.length >= max) break;
    }
  }
  return out;
}

/* Validate a single collaborative whiteboard operation. */
function validOp(raw) {
  if (!isPlainObject(raw) || typeof raw.id !== 'string' || raw.id.length > 80) return null;
  const op = { id: raw.id.slice(0, 80) };
  switch (raw.type) {
    case 'stroke':
      if (!['pen', 'eraser'].includes(raw.tool)) return null;
      op.type = 'stroke';
      op.tool = raw.tool;
      op.points = capPoints(raw.points);
      if (op.points.length < 2) return null;
      op.color = str(raw.color, 64);
      op.size = isNum(raw.size) ? Math.min(200, Math.max(1, raw.size)) : 4;
      return op;
    case 'shape':
      if (!['rect', 'ellipse'].includes(raw.tool)) return null;
      op.type = 'shape';
      op.tool = raw.tool;
      op.x = isNum(raw.x) ? raw.x : 0;
      op.y = isNum(raw.y) ? raw.y : 0;
      op.w = isNum(raw.w) ? raw.w : 0;
      op.h = isNum(raw.h) ? raw.h : 0;
      op.color = str(raw.color, 64);
      op.size = isNum(raw.size) ? Math.min(200, Math.max(1, raw.size)) : 4;
      op.fill = Boolean(raw.fill);
      return op;
    case 'text':
      op.type = 'text';
      op.x = isNum(raw.x) ? raw.x : 0;
      op.y = isNum(raw.y) ? raw.y : 0;
      op.text = str(raw.text, 1000);
      op.color = str(raw.color, 64);
      op.size = isNum(raw.size) ? Math.min(200, Math.max(6, raw.size)) : 24;
      return op;
    case 'move':
      op.type = 'move';
      op.id = str(raw.target || raw.id, 80);
      op.dx = isNum(raw.dx) ? raw.dx : 0;
      op.dy = isNum(raw.dy) ? raw.dy : 0;
      return op;
    case 'modify':
      op.type = 'modify';
      op.id = str(raw.target || raw.id, 80);
      op.patch = isPlainObject(raw.patch) ? raw.patch : {};
      return op;
    case 'delete':
      op.type = 'delete';
      op.id = str(raw.target || raw.id, 80);
      return op;
    default:
      return null;
  }
}

const MAX_OPS = 5000;

/**
 * Socket.IO server for SecureNexus (Phase 3 real-time live interview system).
 *
 *  - Authentication: JWT verified at the handshake AND the user is loaded from
 *    MongoDB (active check). A client-supplied userId is never trusted.
 *  - Secure rooms: join-room verifies the interview exists and the authenticated
 *    user is allowed (candidate/interviewer/recruiter/admin). Errors returned via
 *    'room-error' with { code: 401|403|404|409 }.
 *  - Live presence: participant-joined / participant-left / participant-disconnected.
 *  - Live chat: validated + persisted to MongoDB, broadcast only to the room.
 *  - Collaborative whiteboard: operation-based sync (whiteboard:op etc.) with
 *    throttling; initial state via whiteboard:init. No full-canvas broadcast.
 *  - Live cursor: cursor:move throttled per socket.
 *  - Interview timer: timer-sync broadcast + timer:control persisted to the session.
 *  - Security events: validated relay to the room (persistence is done via REST).
 *  - WebRTC signaling: authenticated, targeted SDP/ICE relay only. Media stays
 *    peer-to-peer and is never routed through this server.
 */
function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map((s) => s.trim()),
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    },
  });

  /** Maps socket.id -> { user, room } */
  const presence = new Map();
  /** Maps roomId -> Set of socket ids */
  const rooms = new Map();
  /** Maps socket.id -> last cursor broadcast timestamp (throttle) */
  const cursorThrottle = new Map();
  /** Maps socket.id -> last timer payload hash (avoid echo storms) */
  const lastTimerHash = new Map();

  function roomName(interviewId) {
    return `interview:${interviewId}`;
  }

  function addToRoom(socketId, room, user) {
    presence.set(socketId, { user, room });
    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room).add(socketId);
  }

  function removeFromRoom(socketId) {
    const entry = presence.get(socketId);
    if (entry) {
      const set = rooms.get(entry.room);
      if (set) set.delete(socketId);
      if (set && set.size === 0) rooms.delete(entry.room);
      presence.delete(socketId);
    }
    return entry;
  }

  function roomMembers(room) {
    const set = rooms.get(room) || new Set();
    const members = [];
    for (const sid of set) {
      const entry = presence.get(sid);
      if (entry && entry.user) {
        members.push({
          socketId: sid,
          userId: entry.user.id,
          name: entry.user.name,
          role: entry.user.role,
        });
      }
    }
    return members;
  }

  async function syncActiveParticipantCount(interviewId, room) {
    try {
      const session = await sessions.findOne({ interviewId });
      if (session) {
        await sessions.updateById(session._id, {
          $set: { activeParticipants: roomMembers(room).length },
        });
      }
    } catch (err) {
      logger.warn('active participant count update failed:', err && err.message);
    }
  }

  async function recordParticipantEvent(interviewId, sessionId, participant, eventType, severity = 'LOW') {
    try {
      await securityEvents.insertOne({
        interviewId,
        sessionId: sessionId || null,
        userId: participant.userId || null,
        eventType,
        severity,
        source: 'socket',
        metadata: { participantId: participant.userId || participant.socketId, displayName: String(participant.name || '').slice(0, 120) },
      });
    } catch (err) {
      logger.warn('participant event persist failed:', err && err.message);
    }
  }

async function authorizeRoom(user, interviewId) {
    const interview = await interviews.findById(interviewId).catch(() => null);
    if (!interview) return { ok: false, code: 404, message: 'Interview not found' };

    if (interview.status === 'completed' || interview.status === 'cancelled') {
      return {
        ok: false,
        code: 409,
        message: `Interview is already '${interview.status}'`,
        interview,
      };
    }

    const uid = String(user.id);
    const isCandidate = interview.candidateId && String(interview.candidateId) === uid;
    const isInterviewer = interview.interviewerId && String(interview.interviewerId) === uid;
    const isRecruiter = interview.recruiterId && String(interview.recruiterId) === uid;
    const isCreator = interview.createdBy && String(interview.createdBy) === uid;
    const isAdmin = user.role === 'admin';

    // Keep Socket.IO room authorization consistent with the REST session
    // authorization. Candidate-created interviews have no recruiterId, so
    // the creator check is required for those rooms.
    if (!(isCandidate || isInterviewer || isRecruiter || isCreator || isAdmin)) {
      return { ok: false, code: 403, message: 'You are not authorized for this interview room' };
    }

    // Ensure a session record exists (create pending if needed).
    let session = await sessions.findOne({ interviewId }).catch(() => null);
    if (!session) {
      session = await sessions.insertOne({
        interviewId,
        status: 'pending',
        startedAt: null,
        endedAt: null,
        timerSecondsRemaining: 0,
        totalSeconds: 0,
        activeParticipants: 0,
        createdBy: user.id,
      });
    }

    return { ok: true, code: 200, interview, session };
  }

  /* Load or create the whiteboard doc for an interview. */
  async function ensureBoard(interviewId) {
    let row = await board.findOne({ interviewId }).catch(() => null);
    if (!row) {
      row = await board.insertOne({ interviewId, strokes: [], ops: [], updatedBy: null });
    }
    return row;
  }

  /* Persist an op (or a batch) to the whiteboard document. */
  async function persistOps(interviewId, ops) {
    const row = await ensureBoard(interviewId);
    const current = Array.isArray(row.ops) ? row.ops : [];
    let next = [...current];
    for (const op of ops) {
      if (op.type === 'clear') {
        next = [];
        continue;
      }
      if (op.type === 'delete') {
        next = next.filter((o) => o.id !== op.id);
        continue;
      }
      if (op.type === 'move' || op.type === 'modify') {
        next = next.map((o) => {
          if (o.id !== op.id) return o;
          if (op.type === 'move') return { ...o, x: (o.x || 0) + op.dx, y: (o.y || 0) + op.dy };
          return { ...o, ...op.patch };
        });
        continue;
      }
      const idx = next.findIndex((o) => o.id === op.id);
      if (idx >= 0) next[idx] = op;
      else next.push(op);
      if (next.length > MAX_OPS) next = next.slice(next.length - MAX_OPS);
    }
    await board.updateById(row._id, { $set: { ops: next, updatedBy: null, updatedAt: new Date() } });
    return next;
  }

  /* Socket handshake authentication middleware. */
  io.use(async (socket, next) => {
    const token =
      (socket.handshake.auth && socket.handshake.auth.token) ||
      (socket.handshake.query && socket.handshake.query.token);
    const decoded = token ? verifyToken(token) : null;
    if (!decoded || !decoded.id) {
      return next(new Error('unauthorized'));
    }
    const user = await users.findById(decoded.id).catch(() => null);
    if (!user) return next(new Error('unauthorized'));
    if (user.isActive === false) return next(new Error('forbidden'));
    socket.data.user = {
      id: String(user._id || user.id),
      name: user.name,
      email: user.email,
      role: user.role,
    };
    return next();
  });

io.on('connection', (socket) => {
    const user = socket.data.user;
    logger.info('Socket connected:', user.email || user.id);

    socket.emit('socket-status', { status: 'connected' });

    /* ---------------- Room management ---------------- */
    socket.on('join-room', async (payload) => {
      const interviewId = payload && payload.interviewId;
      if (typeof interviewId !== 'string' || !interviewId.trim()) {
        socket.emit('room-error', { code: 400, message: 'interviewId is required' });
        return;
      }

      let decision;
      try {
        decision = await authorizeRoom(user, interviewId);
      } catch (err) {
        logger.warn('join-room authorization failed:', err && err.message);
        socket.emit('room-error', { code: 500, message: 'Unable to join the room right now' });
        return;
      }
      if (!decision.ok) {
        socket.emit('room-error', { code: decision.code, message: decision.message });
        return;
      }

      const room = roomName(interviewId);
      // Leave any previous room cleanly.
      const prev = removeFromRoom(socket.id);
      if (prev && prev.room !== room) {
        socket.leave(prev.room);
        await syncActiveParticipantCount(prev.room.replace('interview:', ''), prev.room);
        socket.to(prev.room).emit('participant-left', {
          socketId: socket.id,
          userId: user.id,
          name: user.name,
          role: user.role,
        });
        socket.to(prev.room).emit('webrtc:peer-left', { socketId: socket.id });
      }

      socket.join(room);
      addToRoom(socket.id, room, user);
      await syncActiveParticipantCount(interviewId, room);

      const participant = { socketId: socket.id, userId: user.id, name: user.name, role: user.role };
      const assignedUsers = new Set([
        decision.interview.candidateId,
        decision.interview.recruiterId,
        decision.interview.interviewerId,
      ].filter(Boolean).map(String));
      const expectedParticipants = Number(decision.interview.expectedParticipants) || Math.max(2, assignedUsers.size);
      const currentCount = roomMembers(room).length;
      await recordParticipantEvent(interviewId, decision.session && decision.session._id, participant, 'PARTICIPANT_JOINED');
      if (currentCount > expectedParticipants) {
        await recordParticipantEvent(interviewId, decision.session && decision.session._id, participant, 'UNEXPECTED_PARTICIPANT', 'HIGH');
        const timestamp = new Date().toISOString();
        io.to(room).emit('participant:unexpected', { ...participant, currentCount, expectedParticipants });
        io.to(room).emit('security-event', {
          eventType: 'UNEXPECTED_PARTICIPANT',
          severity: 'HIGH',
          details: { currentCount, expectedParticipants },
          byId: user.id,
          byName: user.name,
          socketId: socket.id,
          timestamp,
        });
      }

      socket.to(room).emit('participant-joined', {
        socketId: socket.id,
        userId: user.id,
        name: user.name,
        role: user.role,
      });

      // Load existing whiteboard + timer state for this new member. A failure in
      // these optional state loads must NEVER suppress the mandatory presence /
      // join handshake (room-joined + participant-joined), otherwise the joining
      // client is left hanging and other participants miss the presence event.
      const session = decision.session;
      let ops = [];
      try {
        const boardRow = await ensureBoard(interviewId);
        ops = Array.isArray(boardRow.ops) ? boardRow.ops : [];
      } catch (err) {
        logger.warn('join-room whiteboard state load failed:', err && err.message);
      }

      try {
        const startedAt = session && session.startedAt ? new Date(session.startedAt).getTime() : null;
        const elapsed = startedAt && (session.status === 'active' || session.status === 'paused')
          ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
          : 0;
        let timerSeconds = session ? Number(session.timerSecondsRemaining) || 0 : 0;
        if (session && session.status === 'active' && timerSeconds > 0) {
          timerSeconds = Math.max(0, timerSeconds - elapsed);
        }

        socket.emit('room-joined', {
          code: 200,
          interviewId,
          sessionId: session ? String(session._id) : null,
          sessionStatus: session ? session.status : 'pending',
          members: roomMembers(room),
        });
        socket.emit('whiteboard:init', { ops, interviewId });
        socket.emit('timer-sync', {
          seconds: timerSeconds,
          status: session ? session.status : 'pending',
          source: 'server',
          ts: Date.now(),
        });
      } catch (err) {
        logger.warn('join-room response emit failed:', err && err.message);
        // Best-effort fallback so the joining client is never left hanging.
        socket.emit('room-joined', {
          code: 200,
          interviewId,
          sessionStatus: session ? session.status : 'pending',
          members: roomMembers(room),
        });
      }
      logger.info('Joined room', room);
    });

    socket.on('leave-room', async () => {
      const prev = removeFromRoom(socket.id);
      if (prev) {
        socket.leave(prev.room);
        const interviewId = prev.room.replace('interview:', '');
        await syncActiveParticipantCount(interviewId, prev.room);
        await recordParticipantEvent(interviewId, null, {
          socketId: socket.id, userId: user.id, name: user.name, role: user.role,
        }, 'PARTICIPANT_LEFT');
        socket.to(prev.room).emit('participant-left', {
          socketId: socket.id,
          userId: user.id,
          name: user.name,
          role: user.role,
        });
      }
    });

    /* ---------------- Live chat (validated + persisted) ---------------- */
    socket.on('chat-message', async (payload) => {
      const entry = presence.get(socket.id);
      const room = entry ? entry.room : null;
      const content = payload && payload.content;
      if (!room || typeof content !== 'string') return;
      const trimmed = content.trim().slice(0, 2000);
      if (!trimmed) return;
      const interviewId = room.replace('interview:', '');

      let recent;
      try {
        recent = await chat.insertOne({
          interviewId,
          senderId: user.id,
          senderName: user.name || 'User',
          content: trimmed,
          type: 'text',
        });
      } catch (err) {
        // A persistence hiccup must not silently drop the real-time delivery
        // (that would also hide the failure from the room). Log it loudly so
        // operators can see it; the broadcast still carries the payload.
        logger.warn('chat persist failed:', err && err.message);
        recent = {
          interviewId,
          senderId: user.id,
          senderName: user.name || 'User',
          content: trimmed,
          type: 'text',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      io.to(room).emit('chat-message', recent);
    });

    /* ---------------- Collaborative whiteboard (op-based) ---------------- */
    // Backward-compatible legacy event: replaces the whole stroke list.
    socket.on('whiteboard-update', async (payload) => {
      const entry = presence.get(socket.id);
      const room = entry ? entry.room : null;
      if (!room) return;
      const strokes = payload && payload.strokes;
      if (!Array.isArray(strokes)) return;
      const interviewId = room.replace('interview:', '');
      const row = await ensureBoard(interviewId);
      await board.updateById(row._id, { $set: { strokes, updatedBy: user.id, updatedAt: new Date() } });
      socket.to(room).emit('whiteboard-update', { strokes, by: user.name, socketId: socket.id });
    });

    socket.on('whiteboard:op', async (payload) => {
      const entry = presence.get(socket.id);
      const room = entry ? entry.room : null;
      if (!room) return;

      let ops = null;
      if (isPlainObject(payload) && payload.op) {
        const one = validOp(payload.op);
        if (one) ops = [one];
      } else if (isPlainObject(payload) && Array.isArray(payload.ops)) {
        ops = payload.ops.map(validOp).filter(Boolean);
      }
      if (!ops || ops.length === 0) return;

      const interviewId = room.replace('interview:', '');
      try {
        await persistOps(interviewId, ops);
      } catch (err) {
        logger.warn('whiteboard persist failed:', err.message);
      }
      socket.to(room).emit('whiteboard:op', { ops, by: user.name, socketId: socket.id, ts: Date.now() });
    });

    socket.on('whiteboard:clear', async () => {
      const entry = presence.get(socket.id);
      const room = entry ? entry.room : null;
      if (!room) return;
      const interviewId = room.replace('interview:', '');
      try {
        const row = await ensureBoard(interviewId);
        await board.updateById(row._id, { $set: { ops: [], strokes: [], updatedAt: new Date() } });
      } catch (err) {
        logger.warn('whiteboard clear persist failed:', err.message);
      }
      io.to(room).emit('whiteboard:clear', { by: user.name, socketId: socket.id, ts: Date.now() });
    });

/* ---------------- Live cursor (throttled) ---------------- */
    socket.on('cursor:move', (payload) => {
      const entry = presence.get(socket.id);
      const room = entry ? entry.room : null;
      if (!room) return;
      if (!isPlainObject(payload) || !isNum(payload.x) || !isNum(payload.y)) return;
      const now = Date.now();
      const last = cursorThrottle.get(socket.id) || 0;
      if (now - last < 60) return; // throttle to ~16/sec
      cursorThrottle.set(socket.id, now);
      socket.to(room).emit('cursor:move', {
        x: payload.x,
        y: payload.y,
        userId: user.id,
        name: user.name,
        socketId: socket.id,
        ts: now,
      });
    });

    /* ---------------- Interview timer ---------------- */
    socket.on('timer-sync', (payload) => {
      const entry = presence.get(socket.id);
      const room = entry ? entry.room : null;
      if (!room || !isPlainObject(payload)) return;
      const seconds = isNum(payload.seconds) ? Math.max(0, Math.round(payload.seconds)) : null;
      const status = typeof payload.status === 'string' ? payload.status.slice(0, 20) : null;
      if (seconds === null) return;
      const hash = `${seconds}:${status || ''}`;
      if (lastTimerHash.get(socket.id) === hash) return; // avoid echo storms
      lastTimerHash.set(socket.id, hash);
      io.to(room).emit('timer-sync', { seconds, status, byId: socket.id, ts: Date.now() });
    });

    // timer:control { action: 'start'|'pause'|'resume'|'end', seconds? }
    socket.on('timer:control', async (payload) => {
      const entry = presence.get(socket.id);
      const room = entry ? entry.room : null;
      if (!room || !isPlainObject(payload)) return;
      const action = payload.action;
      const interviewId = room.replace('interview:', '');
      if (!['start', 'pause', 'resume', 'end', 'cancel'].includes(action)) {
        socket.emit('room-error', { code: 400, message: `Invalid timer action: ${action}` });
        return;
      }

      const session = await sessions.findOne({ interviewId }).catch(() => null);
      if (!session) return;
      const interview = await interviews.findById(interviewId).catch(() => null);

      const seconds = isNum(payload.seconds) ? Math.max(0, Math.round(payload.seconds)) : null;
      let nextStatus = session.status;
      let nextSeconds = session.timerSecondsRemaining || 0;
      let startedAt = session.startedAt || new Date();

      if (action === 'start') {
        nextStatus = 'active';
        startedAt = session.startedAt || new Date();
        nextSeconds = seconds !== null ? seconds : Number(interview && interview.durationMinutes) * 60 || 3600;
      } else if (action === 'pause') {
        nextStatus = 'paused';
        if (seconds !== null) {
          nextSeconds = seconds;
        } else if (session.status === 'active' && session.startedAt) {
          const elapsed = Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
          nextSeconds = Math.max(0, Number(session.timerSecondsRemaining || 0) - elapsed);
        }
      } else if (action === 'resume') {
        nextStatus = 'active';
        startedAt = new Date();
        if (seconds !== null) nextSeconds = seconds;
      } else if (action === 'end') {
        nextStatus = 'completed';
        await interviews.updateById(interviewId, { $set: { status: 'completed' } });
      } else if (action === 'cancel') {
        nextStatus = 'cancelled';
        await interviews.updateById(interviewId, { $set: { status: 'cancelled' } });
      }

      try {
        await sessions.updateById(session._id, {
          $set: {
            status: nextStatus,
            startedAt: action === 'pause' ? session.startedAt : startedAt,
            timerSecondsRemaining: nextSeconds,
            ...(['end', 'cancel'].includes(action) ? { endedAt: new Date() } : { endedAt: null }),
          },
        });
      } catch (err) {
        logger.warn('timer control persist failed:', err.message);
      }

      io.to(room).emit('timer:control', {
        action,
        seconds: nextSeconds,
        status: nextStatus,
        byId: socket.id,
        byName: user.name,
        ts: Date.now(),
      });
      io.to(room).emit('timer-sync', { seconds: nextSeconds, status: nextStatus, byId: socket.id, ts: Date.now() });
    });


    /* ---------------- Session status relay ---------------- */
    socket.on('session-status', (payload) => {
      const entry = presence.get(socket.id);
      const room = entry ? entry.room : null;
      if (!room || !isPlainObject(payload)) return;
      io.to(room).emit('session-status', {
        status: str(payload.status, 20),
        byId: user.id,
        byName: user.name,
        timestamp: new Date().toISOString(),
      });
    });

    /* ---------------- WebRTC signaling (media remains peer-to-peer) ---------------- */
    function relayWebrtc(eventName, payload) {
      const entry = presence.get(socket.id);
      const room = entry ? entry.room : null;
      if (!room || !isPlainObject(payload)) return;
      const targetSocketId = str(payload.targetSocketId, 100);
      const target = presence.get(targetSocketId);
      if (!target || target.room !== room) return;

      const forwarded = { fromSocketId: socket.id, fromRole: user.role };
      if (eventName === 'webrtc:ice-candidate') {
        if (!isPlainObject(payload.candidate)) return;
        forwarded.candidate = payload.candidate;
      } else {
        if (!isPlainObject(payload.sdp) || typeof payload.sdp.type !== 'string' || typeof payload.sdp.sdp !== 'string') return;
        forwarded.sdp = { type: payload.sdp.type, sdp: payload.sdp.sdp };
      }
      io.to(targetSocketId).emit(eventName, forwarded);
    }

    socket.on('webrtc:offer', (payload) => relayWebrtc('webrtc:offer', payload));
    socket.on('webrtc:answer', (payload) => relayWebrtc('webrtc:answer', payload));
    socket.on('webrtc:ice-candidate', (payload) => relayWebrtc('webrtc:ice-candidate', payload));
    socket.on('webrtc:call-ended', (payload) => {
      const entry = presence.get(socket.id);
      const room = entry ? entry.room : null;
      const targetSocketId = str(payload && payload.targetSocketId, 100);
      const target = presence.get(targetSocketId);
      if (room && target && target.room === room) {
        io.to(targetSocketId).emit('webrtc:call-ended', { fromSocketId: socket.id });
      }
    });

    socket.on('disconnect', () => {
      const prev = removeFromRoom(socket.id);
      cursorThrottle.delete(socket.id);
      lastTimerHash.delete(socket.id);
      if (prev) {
        const interviewId = prev.room.replace('interview:', '');
        void syncActiveParticipantCount(interviewId, prev.room);
        void recordParticipantEvent(interviewId, null, {
          socketId: socket.id, userId: user ? user.id : null, name: user ? user.name : 'User', role: user ? user.role : 'unknown',
        }, 'PARTICIPANT_LEFT');
        socket.to(prev.room).emit('participant-disconnected', {
          socketId: socket.id,
          userId: user ? user.id : null,
          name: user ? user.name : 'User',
          role: user ? user.role : 'unknown',
        });
        socket.to(prev.room).emit('webrtc:peer-left', { socketId: socket.id });
      }
      logger.info('Socket disconnected');
    });
  });

  return io;
}

module.exports = { initSocket };
