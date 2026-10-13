
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Interview = require('../models/Interview');
const InterviewSession = require('../models/InterviewSession');
const Submission = require('../models/Submission');
const Question = require('../models/Question');
const SecurityEvent = require('../models/SecurityEvent');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const RecruiterNote = require('../models/RecruiterNote');
const { collection, getMode } = require('../storage/storage');
const { ok, created, fail } = require('../utils/response');
const { writeAudit } = require('../utils/audit');
const { deriveDashboardMetrics } = require('../services/dashboardMetricsService');

const users = collection('users', User);
const interviews = collection('interviews', Interview);
const sessions = collection('sessions', InterviewSession);
const submissions = collection('submissions', Submission);
const questions = collection('questions', Question);
const securityEvents = collection('securityevents', SecurityEvent);
const notes = collection('notes', RecruiterNote);
const notifications = collection('notifications', Notification);
const auditLogs = collection('auditlogs', AuditLog);

const VALID_ROLES = ['admin', 'recruiter', 'interviewer', 'candidate'];

function sanitizeUser(user) {
  if (!user) return null;
  const { password, ...safe } = user;
  void password;
  return safe;
}

/** GET /api/users?role=&search= — admin only */
async function listUsers(req, res, next) {
  try {
    const { role, search } = req.query || {};
    const query = {};
    if (role && VALID_ROLES.includes(role)) query.role = role;
    const rows = await users.find(query);
    let filtered = rows;
    if (search) {
      const s = String(search).toLowerCase();
      filtered = rows.filter(
        (u) =>
          String(u.name || '').toLowerCase().includes(s) ||
          String(u.email || '').toLowerCase().includes(s)
      );
    }
    return ok(res, filtered.map(sanitizeUser));
  } catch (err) {
    return next(err);
  }
}

/** POST /api/users — admin creates a user (any role) */
async function createUser(req, res, next) {
  try {
    const { name, email, password, role, mobile } = req.body || {};
    if (!name || !email) return fail(res, 400, 'name and email are required');
    if (!VALID_ROLES.includes(role)) return fail(res, 400, `role must be one of ${VALID_ROLES.join(', ')}`);
    const existing = await users.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) return fail(res, 409, 'User with that email exists');

    const hash = password ? await bcrypt.hash(String(password), 10) : '';
    const user = await users.insertOne({
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password: hash,
      role,
      mobile: mobile || '',
      profileImage: '',
      skills: [],
      isActive: true,
    });
    await writeAudit(req, 'user.created', { userId: user._id, targetEmail: user.email, role });
    return created(res, sanitizeUser(user), 'User created');
  } catch (err) {
    return next(err);
  }
}

/** PUT /api/users/:id — admin updates a user (role, active, profile) */
async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { name, role, mobile, profileImage, skills, isActive } = req.body || {};
    const set = {};
    if (name !== undefined) set.name = String(name).trim();
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) return fail(res, 400, 'Invalid role');
      set.role = role;
    }
    if (mobile !== undefined) set.mobile = mobile;
    if (profileImage !== undefined) set.profileImage = profileImage;
    if (skills !== undefined) set.skills = Array.isArray(skills) ? skills : [];
    if (isActive !== undefined) set.isActive = Boolean(isActive);

    const updated = await users.updateById(id, { $set: set });
    if (!updated) return fail(res, 404, 'User not found');
    await writeAudit(req, 'user_update', { userId: id });
    return ok(res, sanitizeUser(updated), 'User updated');
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/users/:id — admin deletes a user */
async function deleteUser(req, res, next) {
  try {
    const removed = await users.deleteById(req.params.id);
    if (!removed) return fail(res, 404, 'User not found');
    await writeAudit(req, 'user_delete', { userId: req.params.id });
    return ok(res, null, 'User deleted');
  } catch (err) {
    return next(err);
  }
}

/** PUT /api/users/me — current user updates their own profile */
async function updateMe(req, res, next) {
  try {
    const { name, mobile, profileImage, skills } = req.body || {};
    const set = {};
    if (name !== undefined) set.name = String(name).trim();
    if (mobile !== undefined) set.mobile = mobile;
    if (profileImage !== undefined) set.profileImage = profileImage;
    if (skills !== undefined) set.skills = Array.isArray(skills) ? skills : [];

    const updated = await users.updateById(req.userId, { $set: set });
    return ok(res, sanitizeUser(updated), 'Profile updated');
  } catch (err) {
    return next(err);
  }
}
/* ============ DASHBOARD ANALYTICS (real stored data) ============ */

/** GET /api/users/stats — dashboard analytics from real backend data */
async function dashboardStats(req, res, next) {
  try {
    const now = new Date();
    const [allUsers, interviewRows, submissionRows, questionRows, criticalEvents, unreadNotifications, notesForMe] = await Promise.all([
      users.find({}),
      interviews.find({}),
      submissions.find({}),
      questions.find({}),
      securityEvents.find({ severity: 'CRITICAL' }),
      notifications.count({ userId: req.userId, read: false }),
      notes.count({ recruiterId: req.userId }),
    ]);
    const metrics = deriveDashboardMetrics({
      users: allUsers,
      interviews: interviewRows,
      submissions: submissionRows,
      questions: questionRows,
      criticalSecurityEvents: criticalEvents,
      now,
    });

    return ok(res, {
      storageMode: getMode(),
      ...metrics,
      unreadNotifications,
      recruiterNoteCount: notesForMe,
    });
  } catch (err) {
    return next(err);
  }
}

/* ============ NOTIFICATIONS ============ */

/** GET /api/notifications — current user's notifications */
async function myNotifications(req, res, next) {
  try {
    const rows = await notifications.find(
      { userId: req.userId },
      { sort: { createdAt: -1 }, limit: 50 }
    );
    return ok(res, rows);
  } catch (err) {
    return next(err);
  }
}

/** PUT /api/notifications/:id/read */
async function markNotificationRead(req, res, next) {
  try {
    const updated = await notifications.updateById(req.params.id, { $set: { read: true } });
    if (!updated) return fail(res, 404, 'Notification not found');
    return ok(res, updated, 'Marked as read');
  } catch (err) {
    return next(err);
  }
}

/** PUT /api/notifications/read-all */
async function markAllNotificationsRead(req, res, next) {
  try {
    const rows = await notifications.find({ userId: req.userId, read: false });
    for (const row of rows) {
      await notifications.updateById(row._id, { $set: { read: true } });
    }
    return ok(res, { updated: rows.length }, 'All notifications marked as read');
  } catch (err) {
    return next(err);
  }
}

/* ============ AUDIT LOGS ============ */

/** GET /api/audit-logs — admin only */
async function auditLogsList(req, res, next) {
  try {
    const rows = await auditLogs.find({}, { sort: { timestamp: -1 }, limit: 200 });
    return ok(res, rows);
  } catch (err) {
    return next(err);
  }
}
module.exports = {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  updateMe,
  dashboardStats,
  myNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  auditLogsList,
};