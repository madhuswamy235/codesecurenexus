const express = require('express');
const { upload } = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const { ok, fail } = require('../utils/response');
const { writeAudit } = require('../utils/audit');

const router = express.Router();

/** POST /api/upload — single file upload (avatar, resume, docs) */
router.post('/', protect, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return fail(res, 400, 'No file uploaded');
    await writeAudit(req, 'upload.file', { filename: req.file.filename, size: req.file.size });
    return ok(
      res,
      {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        url: `/uploads/${req.file.filename}`,
      },
      'File uploaded'
    );
  } catch (err) {
    return next(err);
  }
});

/** POST /api/upload/multiple — multiple file upload */
router.post('/multiple', protect, upload.array('files', 10), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) return fail(res, 400, 'No files uploaded');
    const files = req.files.map((f) => ({
      filename: f.filename,
      originalname: f.originalname,
      size: f.size,
      mimetype: f.mimetype,
      url: `/uploads/${f.filename}`,
    }));
    await writeAudit(req, 'upload.multiple', { count: files.length });
    return ok(res, { files }, `${files.length} file(s) uploaded`);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;