const RecruiterNote = require('../models/RecruiterNote');
const { collection } = require('../storage/storage');
const { ok, created, fail } = require('../utils/response');
const { writeAudit } = require('../utils/audit');

const notes = collection('notes', RecruiterNote);

/** POST /api/notes — create a recruiter note */
async function createNote(req, res, next) {
  try {
    const { interviewId, content } = req.body || {};
    if (!interviewId) return fail(res, 400, 'interviewId is required');
    if (!content || !String(content).trim()) return fail(res, 400, 'content is required');

    const record = await notes.insertOne({
      interviewId,
      recruiterId: req.userId,
      content: String(content).trim(),
    });
    await writeAudit(req, 'note.create', { interviewId });
    return created(res, record, 'Note saved');
  } catch (err) {
    return next(err);
  }
}

/** GET /api/notes/interview/:interviewId */
async function getInterviewNotes(req, res, next) {
  try {
    const rows = await notes.find(
      { interviewId: req.params.interviewId },
      { sort: { createdAt: -1 } }
    );
    return ok(res, rows);
  } catch (err) {
    return next(err);
  }
}

/** PUT /api/notes/:id */
async function updateNote(req, res, next) {
  try {
    const { content } = req.body || {};
    if (!content || !String(content).trim()) return fail(res, 400, 'content is required');
    const updated = await notes.updateById(req.params.id, { $set: { content: String(content).trim() } });
    if (!updated) return fail(res, 404, 'Note not found');
    await writeAudit(req, 'note.update', { noteId: req.params.id });
    return ok(res, updated, 'Note updated');
  } catch (err) {
    return next(err);
  }
}

/** DELETE /api/notes/:id */
async function deleteNote(req, res, next) {
  try {
    const removed = await notes.deleteById(req.params.id);
    if (!removed) return fail(res, 404, 'Note not found');
    await writeAudit(req, 'note.delete', { noteId: req.params.id });
    return ok(res, null, 'Note deleted');
  } catch (err) {
    return next(err);
  }
}

module.exports = { createNote, getInterviewNotes, updateNote, deleteNote };