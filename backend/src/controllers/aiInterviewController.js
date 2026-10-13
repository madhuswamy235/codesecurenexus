const crypto = require('crypto');
const AIInterviewSession = require('../models/AIInterviewSession');
const Interview = require('../models/Interview');
const SecurityEvent = require('../models/SecurityEvent');
const { collection } = require('../storage/storage');
const { ok, created, fail } = require('../utils/response');
const { questionFor, evaluateAnswer } = require('../services/aiInterviewService');

const sessions = collection('aiinterviewsessions', AIInterviewSession);
const interviews = collection('interviews', Interview);
const securityEvents = collection('securityevents', SecurityEvent);

function sessionKey() { return `ai_${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`; }
function idOf(row) { return row && (row._id || row.id); }
function safeSession(row) { return row ? { ...row, _id: idOf(row), sessionId: row.sessionId } : row; }

async function start(req, res, next) {
  try {
    const body = req.body || {};
    const id = sessionKey();
    const session = await sessions.insertOne({
      sessionId: id, interviewId: body.interviewId || null, userId: req.userId,
      role: body.role || 'Software Engineer', difficulty: body.difficulty || 'Medium',
      topics: Array.isArray(body.topics) ? body.topics.slice(0, 10) : [], mode: body.mode === 'INTERVIEW' ? 'INTERVIEW' : 'PRACTICE',
      status: 'active', questions: [questionFor(0, body.role, body.topics)],
    });
    return created(res, { sessionId: id, firstQuestion: session.questions[0], mode: 'deterministic-fallback' }, 'AI interview started');
  } catch (err) { return next(err); }
}

async function nextQuestion(req, res, next) {
  try {
    const session = await sessions.findOne({ sessionId: req.body && req.body.sessionId });
    if (!session || String(session.userId) !== String(req.userId)) return fail(res, 404, 'AI interview session not found');
    const index = Array.isArray(session.questions) ? session.questions.length : 0;
    if (index >= 5) return fail(res, 409, 'Interview question limit reached');
    const question = questionFor(index, session.role, session.topics);
    await sessions.updateById(idOf(session), { $push: { questions: question } });
    return ok(res, { question, mode: 'deterministic-fallback' });
  } catch (err) { return next(err); }
}

async function evaluate(req, res, next) {
  try {
    const body = req.body || {};
    const session = await sessions.findOne({ sessionId: body.sessionId });
    if (!session || String(session.userId) !== String(req.userId)) return fail(res, 404, 'AI interview session not found');
    const evaluation = await evaluateAnswer(body);
    const questions = (session.questions || []).map((item) => item.questionId === body.questionId ? { ...item, answer: String(body.answer || ''), evaluation } : item);
    const complete = questions.length >= 5 && questions.every((item) => item.evaluation);
    const finalScore = complete ? Math.round(questions.reduce((sum, item) => sum + Number(item.evaluation.overallScore || 0), 0) / questions.length) : null;
    await sessions.updateById(idOf(session), { $set: { questions, ...(complete ? { status: 'completed', endedAt: new Date(), finalScore } : {}) } });
    return ok(res, { evaluation });
  } catch (err) { return next(err); }
}

async function report(req, res, next) {
  try {
    const session = await sessions.findOne({ sessionId: req.params.sessionId });
    if (!session || String(session.userId) !== String(req.userId)) return fail(res, 404, 'AI interview session not found');
    const answered = (session.questions || []).filter((item) => item.evaluation);
    const average = (key) => answered.length ? Math.round(answered.reduce((sum, item) => sum + Number(item.evaluation[key] || 0), 0) / answered.length) : 0;
    const events = await securityEvents.find({ interviewId: session.interviewId }, { sort: { createdAt: 1 }, limit: 1000 });
    const performanceScore = average('overallScore');
    const integrityScore = Math.max(0, 100 - events.reduce((sum, event) => sum + ({ UNEXPECTED_PARTICIPANT: 20, TAB_SWITCH: 5, NEARBY_DEVICE_DETECTED: 6 }[event.eventType] || 0), 0));
    const strengths = [...new Set(answered.flatMap((item) => item.evaluation.strengths || []))];
    const weaknesses = [...new Set(answered.flatMap((item) => item.evaluation.weaknesses || []))];
    return ok(res, { candidate: req.user.name, role: session.role, duration: session.endedAt ? new Date(session.endedAt) - new Date(session.startedAt) : Date.now() - new Date(session.startedAt), questionsAnswered: answered.length, performanceScore, integrityScore, technicalScore: average('technicalScore'), communicationScore: average('communicationScore'), relevanceScore: average('relevanceScore'), confidenceScore: average('confidenceScore'), securityEvents: events, participantEvents: events.filter((event) => String(event.eventType).startsWith('PARTICIPANT_')), tabSwitchCount: events.filter((event) => event.eventType === 'TAB_SWITCH').length, nearbyDeviceCount: events.filter((event) => event.eventType === 'NEARBY_DEVICE_DETECTED').reduce((sum, event) => sum + (Number(event.details?.nearbyDeviceCount) || 1), 0), unexpectedParticipantCount: events.filter((event) => event.eventType === 'UNEXPECTED_PARTICIPANT').length, strengths, weaknesses, recommendations: weaknesses.length ? ['Practice explaining concepts with concrete examples.', 'Review the topics highlighted in weaker answers.'] : ['Continue practicing concise, structured explanations.'], timeline: answered.map((item) => ({ questionId: item.questionId, question: item.question, category: item.category, evaluation: item.evaluation })) });
  } catch (err) { return next(err); }
}

module.exports = { start, nextQuestion, evaluate, report };