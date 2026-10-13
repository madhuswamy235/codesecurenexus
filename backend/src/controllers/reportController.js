const Report = require('../models/Report');
const { collection } = require('../storage/storage');
const { ok, created, fail } = require('../utils/response');
const { writeAudit } = require('../utils/audit');
const { generateReport } = require('../services/reportService');

const reports = collection('reports', Report);

/** GET /api/reports/interview/:interviewId — generate (or refresh) report data */
async function getInterviewReport(req, res, next) {
  try {
    const { interviewId } = req.params;
    const reportData = await generateReport(interviewId);
    if (!reportData) return fail(res, 404, 'Interview not found');

    // Upsert a persisted Report row so downloadCount/audit are real.
    let existing = await reports.findOne({ interviewId });
    if (existing) {
      existing = await reports.updateById(existing._id, {
        $set: { content: reportData.content, status: 'generated', generatedAt: new Date() },
      });
    } else {
      existing = await reports.insertOne({
        interviewId,
        status: 'generated',
        content: reportData.content,
        generatedBy: req.userId,
        generatedAt: new Date(),
      });
    }

    await writeAudit(req, 'report.generate', { interviewId });
    return ok(res, { report: existing, content: reportData.content }, 'Report generated');
  } catch (err) {
    return next(err);
  }
}

/** GET /api/reports/interview/:interviewId/download — JSON download */
async function downloadInterviewReport(req, res, next) {
  try {
    const { interviewId } = req.params;
    const reportData = await generateReport(interviewId);
    if (!reportData) return fail(res, 404, 'Interview not found');

    let existing = await reports.findOne({ interviewId });
    if (existing) {
      existing = await reports.updateById(existing._id, {
        $inc: { downloadCount: 1 },
      });
    }

    await writeAudit(req, 'report.download', { interviewId });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="securenexus-report-${interviewId}.json"`
    );
    return res.send(JSON.stringify(reportData.content, null, 2));
  } catch (err) {
    return next(err);
  }
}

module.exports = { getInterviewReport, downloadInterviewReport };