const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const ROOM_SCAN_DIR = path.join(__dirname, '..', '..', 'private-room-scans');
fs.mkdirSync(ROOM_SCAN_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, ROOM_SCAN_DIR),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase().slice(0, 10);
    cb(null, `${crypto.randomBytes(18).toString('hex')}${extension}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = file.mimetype.startsWith('video/') || file.mimetype.startsWith('image/');
  cb(allowed ? null : new Error('Room scans accept video or image files only'), allowed);
};

const roomScanUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 100 * 1024 * 1024, files: 8 },
});

module.exports = { roomScanUpload, ROOM_SCAN_DIR };
