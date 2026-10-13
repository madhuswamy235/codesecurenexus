const { analyzeResponse, summarizeInterview, aiStatus } = require('../services/aiService');
const { analyzeSecurityFeatures } = require('../services/riskAnalysisService');
const { ok, fail } = require('../utils/response');

/** GET /api/ai/status — reports whether AI is configured (never leaks keys) */
async function status(req, res, next) {
  try {
    return ok(res, aiStatus());
  } catch (err) {
    return next(err);
  }
}

/** POST /api/ai/analyze-response — written/verbal answer analysis */
async function analyze(req, res, next) {
  try {
    const { text, type } = req.body || {};
    if (!text || !String(text).trim()) return fail(res, 400, 'text is required');
    const result = await analyzeResponse({ text, type });
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
}

/** POST /api/ai/summarize-interview */
async function summarize(req, res, next) {
  try {
    const { interviewTitle, candidateName, answers } = req.body || {};
    const result = await summarizeInterview({ interviewTitle, candidateName, answers });
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
}

async function analyzeSecurity(req, res, next) {
  try {
    return ok(res, analyzeSecurityFeatures(req.body?.features || {}));
  } catch (err) {
    return next(err);
  }
}

module.exports = { status, analyze, summarize, analyzeSecurity };