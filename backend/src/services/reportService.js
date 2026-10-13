const Interview = require('../models/Interview');
const InterviewSession = require('../models/InterviewSession');
const Submission = require('../models/Submission');
const SecurityEvent = require('../models/SecurityEvent');
const RecruiterNote = require('../models/RecruiterNote');
const User = require('../models/User');
const { collection, getMode } = require('../storage/storage');
const { buildSkillBreakdown } = require('./scoringService');

const interviews = collection('interviews', Interview);
const sessions = collection('sessions', InterviewSession);
const submissions = collection('submissions', Submission);
const securityEvents = collection('securityevents', SecurityEvent);
const notes = collection('notes', RecruiterNote);
const users = collection('users', User);

/**
 * Builds a complete report payload from REAL stored data.
 * Returns { report, content } where content is the human-viewable object.
 */
async function generateReport(interviewId) {
  const interview = await interviews.findById(interviewId);
  if (!interview) return null;

  const session = await sessions.findOne({ interviewId });

  const [candidate, interviewer, recruiter] = await Promise.all([
    interview.candidateId ? users.findById(interview.candidateId) : null,
    interview.interviewerId ? users.findById(interview.interviewerId) : null,
    interview.recruiterId ? users.findById(interview.recruiterId) : null,
  ]);

  const subRows = await submissions.find({ interviewId });
  const eventRows = await securityEvents.find({ interviewId }, { sort: { createdAt: 1 } });
  const noteRows = await notes.find({ interviewId }, { sort: { createdAt: -1 } });

  // Count evaluated question rows only. MCQ aggregate and FINAL are summary rows.
  const evaluatedRows = subRows.filter((s) =>
    s.status === 'evaluated' &&
    ['MCQ', 'CODING', 'WRITTEN'].includes(s.type) &&
    !(s.type === 'MCQ' && (s.questionId === null || s.questionId === undefined))
  );
  const skills = buildSkillBreakdown(evaluatedRows);
  const totalScore = evaluatedRows.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
  const totalMax = evaluatedRows.reduce((sum, s) => sum + (Number(s.maxScore) || 0), 0);
  const overallPercentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  const durationSeconds =
    session && session.endedAt && session.startedAt
      ? Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 1000)
      : session && session.totalSeconds
        ? session.totalSeconds
        : 0;

  const status = interview.status === 'completed' ? 'COMPLETED' : interview.status === 'live' ? 'LIVE' : 'SCHEDULED';

  const content = {
    reportId: `REP-${interviewId}`,
    status,
    generatedAt: new Date().toISOString(),
    storageMode: getMode(),
    interview: {
      id: String(interview._id),
      title: interview.title,
      description: interview.description,
      type: interview.type,
      roomCode: interview.roomCode,
      scheduledAt: interview.scheduledAt,
    },
    candidate: candidate
      ? { id: String(candidate._id), name: candidate.name, email: candidate.email, mobile: candidate.mobile }
      : null,
    interviewer: interviewer ? { id: String(interviewer._id), name: interviewer.name, email: interviewer.email } : null,
    recruiter: recruiter ? { id: String(recruiter._id), name: recruiter.name, email: recruiter.email } : null,
    session: session
      ? {
          status: session.status,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          durationSeconds,
          durationMinutes: Math.round(durationSeconds / 60),
          activeParticipants: session.activeParticipants,
        }
      : null,
    assessment: {
      totalSubmissions: evaluatedRows.length,
      mcq: evaluatedRows.filter((s) => s.type === 'MCQ'),
      coding: evaluatedRows.filter((s) => s.type === 'CODING'),
      written: evaluatedRows.filter((s) => s.type === 'WRITTEN'),
      totalScore,
      totalMax,
      overallPercentage,
    },
    skills,
    security: {
      totalEvents: eventRows.length,
      events: eventRows.map((e) => ({
        eventType: e.eventType,
        severity: e.severity,
        details: e.details,
        timestamp: e.createdAt,
      })),
      criticalCount: eventRows.filter((e) => e.severity === 'CRITICAL').length,
    },
    recruiterNotes: noteRows.map((n) => ({ id: String(n._id), content: n.content, createdAt: n.createdAt })),
  };

  return { content, skills, overallPercentage, subRows, eventRows, noteRows, session };
}

module.exports = { generateReport };
