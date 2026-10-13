const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    const safe = path.basename(file.originalname || 'file').replace(ext, '').replace(/[^\w-]+/g, '_');
    cb(null, `${Date.now()}_${safe}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/', 'application/pdf', 'text/', 'application/json', 'application/msword', 'application/vnd.openxmlformats-officedocument'];
  if (allowed.some((prefix) => file.mimetype.startsWith(prefix))) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = { upload };