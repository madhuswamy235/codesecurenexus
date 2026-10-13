const Question = require('../models/Question');
const { collection } = require('../storage/storage');
const { ok, created, fail } = require('../utils/response');
const { writeAudit } = require('../utils/audit');

const questions = collection('questions', Question);

/** GET /api/questions?type=&interviewId= — role aware (candidates get sanitized) */
async function listQuestions(req, res, next) {
  try {
    const { type, interviewId } = req.query || {};
    const query = {};
    if (type) query.type = type;
    if (interviewId) query.interviewId = interviewId;

    const rows = await questions.find(query, { sort: { createdAt: 1 } });

    if (req.userRole === 'candidate') {
      // NEVER leak answers to candidates before submission
      const safe = rows.map((q) => ({
        _id: q._id,
        type: q.type,
        text: q.text,
        options: q.options,
        language: q.language,
        starterCode: q.starterCode,
        maxScore: q.maxScore,
        interviewId: q.interviewId,
      }));
      return ok(res, safe);
    }

    return ok(res, rows);
  } catch (err) {
    return next(err);
  }
}

/** POST /api/questions — interviewer/recruiter/admin create questions */
async function createQuestion(req, res, next) {
  try {
    const {
      interviewId, type, text, options, correctOption, language,
      starterCode, testCases, maxScore, tags,
    } = req.body || {};

    if (!type || !['MCQ', 'CODING', 'WRITTEN'].includes(type)) {
      return fail(res, 400, 'type must be MCQ, CODING, or WRITTEN');
    }
    if (!text || !String(text).trim()) return fail(res, 400, 'text is required');

    const question = await questions.insertOne({
      interviewId: interviewId || null,
      type,
      text: String(text).trim(),
      options: Array.isArray(options) ? options : [],
      correctOption: typeof correctOption === 'number' ? correctOption : -1,
      language: language || 'javascript',
      starterCode: starterCode || '',
      testCases: Array.isArray(testCases) ? testCases : [],
      maxScore: Number(maxScore) || 10,
      tags: Array.isArray(tags) ? tags : [],
    });

    await writeAudit(req, 'question.create', { questionId: question._id, type });
    return created(res, question, 'Question created');
  } catch (err) {
    return next(err);
  }
}

/** PUT /api/questions/:id */
async function updateQuestion(req, res, next) {
  try {
    const updated = await questions.updateById(req.params.id, { $set: req.body });
    if (!updated) return fail(res, 404, 'Question not found');
    await writeAudit(req, 'question.update', { questionId: req.params.id });
    return ok(res, updated, 'Question updated');
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/questions/:id */
async function deleteQuestion(req, res, next) {
  try {
    const removed = await questions.deleteById(req.params.id);
    if (!removed) return fail(res, 404, 'Question not found');
    await writeAudit(req, 'question.delete', { questionId: req.params.id });
    return ok(res, null, 'Question deleted');
  } catch (err) {
    return next(err);
  }
}

module.exports = { listQuestions, createQuestion, updateQuestion, deleteQuestion };
