const Submission = require('../models/Submission');
const Question = require('../models/Question');
const Interview = require('../models/Interview');
const { collection } = require('../storage/storage');
const { ok, created, fail } = require('../utils/response');
const { writeAudit } = require('../utils/audit');
const { scoreMcq, scoreMcqBatch } = require('../services/scoringService');
const { executeCode } = require('../services/codeExecutionService');

const submissions = collection('submissions', Submission);
const questions = collection('questions', Question);
const interviews = collection('interviews', Interview);

/* ---------- GET helpers ---------- */

/** GET /api/submissions?interviewId=&candidateId&=type — role aware */
async function listSubmissions(req, res, next) {
  try {
    const { interviewId, type } = req.query || {};
    const query = {};

    if (interviewId) query.interviewId = interviewId;
    if (type) query.type = type;

    if (req.userRole === 'candidate') query.candidateId = req.userId;

    const rows = await submissions.find(query, { sort: { createdAt: -1 } });
    return ok(res, rows);
  } catch (err) {
    return next(err);
  }
}

/** GET /api/submissions/:id */
async function getSubmission(req, res, next) {
  try {
    const sub = await submissions.findById(req.params.id);
    if (!sub) return fail(res, 404, 'Submission not found');
    return ok(res, sub);
  } catch (err) {
    return next(err);
  }
}

async function chkInterview(interviewId) {
  const interview = interviewId ? await interviews.findById(interviewId) : null;
  return interview;
}

/* ---------- MCQ ---------- */

/** POST /api/assessments/mcq/save — persist selected options (no grade yet) */
async function saveMcq(req, res, next) {
  try {
    const { interviewId, questionId, selectedOption } = req.body || {};
    if (!interviewId || !questionId) return fail(res, 400, 'interviewId and questionId are required');

    let sub = await submissions.findOne({ interviewId, questionId, candidateId: req.userId, type: 'MCQ' });
    if (sub) {
      sub = await submissions.updateById(sub._id, { $set: { selectedOption } });
    } else {
      sub = await submissions.insertOne({
        interviewId,
        questionId,
        candidateId: req.userId,
        type: 'MCQ',
        selectedOption,
        status: 'saved',
        score: 0,
        maxScore: 10,
      });
    }
    return ok(res, sub, 'MCQ answer saved');
  } catch (err) {
    return next(err);
  }
}

/** POST /api/assessments/mcq/submit — grade against stored answers */
async function submitMcq(req, res, next) {
  try {
    const { interviewId, answers } = req.body || {};
    if (!interviewId) return fail(res, 400, 'interviewId is required');
    if (!Array.isArray(answers) || answers.length === 0) return fail(res, 400, 'answers array is required');

    const interview = await chkInterview(interviewId);
    if (!interview) return fail(res, 404, 'Interview not found');

    const questionList = await questions.find({ interviewId, type: 'MCQ' });
    const aggregate = scoreMcqBatch(questionList, answers);

    // Persist each answer + the aggregate result
    for (const a of answers) {
      const q = questionList.find((qq) => String(qq._id) === String(a.questionId));
      if (!q) continue;
      const perQ = (aggregate.perQuestion || []).find((p) => String(p.questionId) === String(a.questionId));
      let sub = await submissions.findOne({ interviewId, questionId: a.questionId, candidateId: req.userId, type: 'MCQ' });
      const doc = {
        selectedOption: Number(a.selectedOption),
        status: 'evaluated',
        score: perQ ? Number(perQ.score) || 0 : 0,
        maxScore: q.maxScore || 10,
        submittedAt: new Date(),
      };
      if (sub) {
        await submissions.updateById(sub._id, { $set: doc });
      } else {
        await submissions.insertOne({
          interviewId,
          questionId: a.questionId,
          candidateId: req.userId,
          type: 'MCQ',
          ...doc,
        });
      }
    }

    // Set aggregate score on the interview-level MCQ submission record
    let aggregateSub = await submissions.findOne({ interviewId, candidateId: req.userId, type: 'MCQ', questionId: null });
    if (aggregateSub) {
      aggregateSub = await submissions.updateById(aggregateSub._id, {
        $set: {
          status: 'evaluated',
          score: aggregate.total,
          maxScore: aggregate.maxTotal,
          submittedAt: new Date(),
          evaluation: { aggregate: true, percentage: aggregate.percentage, perQuestion: aggregate.perQuestion },
        },
      });
    } else {
      aggregateSub = await submissions.insertOne({
        interviewId,
        candidateId: req.userId,
        type: 'MCQ',
        questionId: null,
        status: 'evaluated',
        selectedOption: -1,
        score: aggregate.total,
        maxScore: aggregate.maxTotal,
        submittedAt: new Date(),
        evaluation: { aggregate: true, percentage: aggregate.percentage, perQuestion: aggregate.perQuestion },
      });
    }

    await writeAudit(req, 'assessment.mcq_submit', { interviewId, score: aggregate.total, max: aggregate.maxTotal });
    return ok(res, { aggregate, submission: aggregateSub }, 'MCQ assessment submitted');
  } catch (err) {
    return next(err);
  }
}

/* ---------- CODING ---------- */

/** POST /api/assessments/code/save — persist code (not submitted) */
async function saveCode(req, res, next) {
  try {
    const { interviewId, questionId, language, code } = req.body || {};
    if (!interviewId || !questionId) return fail(res, 400, 'interviewId and questionId are required');

    let sub = await submissions.findOne({ interviewId, questionId, candidateId: req.userId, type: 'CODING' });
    const doc = {
      language: language || 'javascript',
      code: code || '',
      status: 'saved',
      score: 0,
    };
    if (sub) {
      sub = await submissions.updateById(sub._id, { $set: doc });
    } else {
      sub = await submissions.insertOne({
        interviewId,
        questionId,
        candidateId: req.userId,
        type: 'CODING',
        ...doc,
      });
    }
    return ok(res, sub, 'Coding answer saved');
  } catch (err) {
    return next(err);
  }
}

/** POST /api/assessments/code/run — execute code and return output (not graded) */
async function runCode(req, res, next) {
  try {
    const { language, code, input } = req.body || {};
    const result = await executeCode({ language, code, input });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error, result });
    }
    return ok(res, result, 'Code executed');
  } catch (err) {
    return next(err);
  }
}

/** POST /api/assessments/code/submit — run test cases and grade */
async function submitCode(req, res, next) {
  try {
    const { interviewId, questionId, language, code } = req.body || {};
    if (!interviewId || !questionId) return fail(res, 400, 'interviewId and questionId are required');

    const question = await questions.findById(questionId);
    if (!question) return fail(res, 404, 'Question not found');

    const testResult = await executeCode({ language, code });
    const maxScore = question.maxScore || 10;
    let passed = 0;
    let total = 0;
    let testResults = [];
    if (testResult.success) {
      const { evaluateTestCases } = require('../services/codeExecutionService');
      const tcResult = await evaluateTestCases({ language, code, testCases: question.testCases || [] });
      passed = tcResult.passed;
      total = tcResult.total;
      testResults = tcResult.results || [];
    }

    const score = total > 0 ? Math.round((passed / total) * maxScore) : 0;

    let sub = await submissions.findOne({ interviewId, questionId, candidateId: req.userId, type: 'CODING' });
    const doc = {
      language: language || 'javascript',
      code: code || '',
      output: testResultOutput(testResult),
      status: 'evaluated',
      score,
      maxScore,
      submittedAt: new Date(),
      evaluation: {
        testCasesPassed: passed,
        testCasesTotal: total,
        execution: testResult.success ? 'DEV_EXECUTOR' : 'no-execution',
      },
    };
    if (sub) {
      sub = await submissions.updateById(sub._id, { $set: doc });
    } else {
      sub = await submissions.insertOne({
        interviewId,
        questionId,
        candidateId: req.userId,
        type: 'CODING',
        ...doc,
      });
    }

    await writeAudit(req, 'assessment.code_submit', { interviewId, score, max: maxScore });
    return ok(res, { submission: sub, score, maxScore, testsPassed: passed, testsTotal: total, testResults }, 'Code assessment submitted');
  } catch (err) {
    return next(err);
  }
}

/* ---------- WRITTEN ---------- */
async function saveWritten(req, res, next) {
  try {
    const { interviewId, questionId, answerText } = req.body || {};
    if (!interviewId || !questionId) return fail(res, 400, 'interviewId and questionId are required');
    let sub = await submissions.findOne({ interviewId, questionId, candidateId: req.userId, type: 'WRITTEN' });
    const doc = { answerText: String(answerText || ''), status: 'saved', score: 0 };
    if (sub) sub = await submissions.updateById(sub._id, { $set: doc });
    else sub = await submissions.insertOne({ interviewId, questionId, candidateId: req.userId, type: 'WRITTEN', ...doc });
    return ok(res, sub, 'Written answer saved');
  } catch (err) { return next(err); }
}

async function submitWritten(req, res, next) {
  try {
    const { interviewId, questionId, answerText } = req.body || {};
    if (!interviewId || !questionId) return fail(res, 400, 'interviewId and questionId are required');
    const question = await questions.findById(questionId);
    if (!question) return fail(res, 404, 'Question not found');
    const text = String(answerText || '').trim();
    if (!text) return fail(res, 400, 'answerText is required');
    const maxScore = question.maxScore || 10;
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const score = Math.min(maxScore, Math.max(0, Math.round((wordCount / 20) * maxScore)));
    const doc = { answerText: text, status: 'evaluated', score, maxScore, submittedAt: new Date(), evaluation: { wordCount, execution: 'DEV_HEURISTIC' } };
    let sub = await submissions.findOne({ interviewId, questionId, candidateId: req.userId, type: 'WRITTEN' });
    if (sub) sub = await submissions.updateById(sub._id, { $set: doc });
    else sub = await submissions.insertOne({ interviewId, questionId, candidateId: req.userId, type: 'WRITTEN', ...doc });
    await writeAudit(req, 'assessment.written_submit', { interviewId, score, max: maxScore });
    return ok(res, { submission: sub, score, maxScore }, 'Written assessment submitted');
  } catch (err) { return next(err); }
}

/* helper for output string */
function testResultOutput(result) {
  return (result && result.output) || '';
}

/* ---------- FINAL SUBMISSION ---------- */

/**
 * POST /api/assessments/final/submit — combines evaluated MCQ and CODING submissions
 * into one FINAL record.
 *  - Prevents duplicate final submission (409 on a second call).
 *  - Saves a submission timestamp + status.
 *  - Marks the interview 'completed'.
 * Only genuinely evaluated answers are counted; missing sections are reported
 * as 'not-submitted'. No AI evaluation or fabricated scores happen here.
 */
async function submitFinal(req, res, next) {
  try {
    const { interviewId } = req.body || {};
    if (!interviewId) return fail(res, 400, 'interviewId is required');

    const interview = await interviews.findById(interviewId);
    if (!interview) return fail(res, 404, 'Interview not found');

    // Prevent unauthorized access: a candidate may only submit their own.
    if (req.userRole === 'candidate' && String(interview.candidateId) !== req.userId) {
      return fail(res, 403, 'You are not assigned to this interview');
    }

    // Duplicate prevention.
    const existing = await submissions.findOne({
      interviewId,
      candidateId: req.userId,
      type: 'FINAL',
    });
    if (existing) {
      return fail(res, 409, 'Assessment already submitted', {
        submittedAt: existing.submittedAt,
        status: existing.status,
      });
    }

    const rows = await submissions.find({ interviewId, candidateId: req.userId });
    const evaluated = rows.filter((s) => s.type !== 'FINAL' && s.status === 'evaluated');

    const sections = ['MCQ', 'CODING', 'WRITTEN'];
    const perSection = sections.map((t) => {
      // MCQ has BOTH per-question rows AND one interview-level aggregate row
      // (questionId === null). The aggregate row is only an index — counting it
      // alongside the per-question rows would double-count the section's marks.
      const list = evaluated.filter(
        (s) => s.type === t && !(t === 'MCQ' && !s.questionId)
      );
      const score = list.reduce((a, s) => a + (s.score || 0), 0);
      const maxScore = list.length ? list.reduce((a, s) => a + (s.maxScore || 0), 0) : 0;
      return {
        type: t,
        count: list.length,
        score,
        maxScore,
        status: list.length ? 'evaluated' : 'not-submitted',
      };
    });

    const totalScore = perSection.reduce((a, s) => a + s.score, 0);
    const totalMax = perSection.reduce((a, s) => a + s.maxScore, 0);
    const overallPercentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

    const finalSub = await submissions.insertOne({
      interviewId,
      candidateId: req.userId,
      type: 'FINAL',
      questionId: null,
      status: 'submitted',
      submittedAt: new Date(),
      score: totalScore,
      maxScore: totalMax,
      evaluation: { perSection, totalScore, totalMax, overallPercentage },
    });

    await interviews.updateById(interviewId, { $set: { status: 'completed' } });
    await writeAudit(req, 'assessment.final_submit', {
      interviewId,
      score: totalScore,
      max: totalMax,
    });

    return ok(
      res,
      {
        submission: finalSub,
        perSection,
        totalScore,
        totalMax,
        overallPercentage,
      },
      'Assessment submitted successfully'
    );
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listSubmissions,
  getSubmission,
  saveMcq,
  submitMcq,
  saveCode,
  runCode,
  submitCode,
  saveWritten,
  submitWritten,
  submitFinal,
};
