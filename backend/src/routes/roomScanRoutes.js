const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { roomScanUpload } = require('../middleware/roomScanUpload');
const {
  createRoomScanToken, getRoomScanByToken, submitRoomScan,
  listRoomScans, streamRoomScanMedia, markRoomScanReviewed,
} = require('../controllers/roomScanController');

const router = express.Router();
router.post('/interviews/:interviewId/token', protect, createRoomScanToken);
router.get('/token/:token', getRoomScanByToken);
router.post('/token/:token/upload', roomScanUpload.array('media', 8), submitRoomScan);
router.get('/interviews/:interviewId', protect, listRoomScans);
router.get('/:scanId/media/:index', protect, streamRoomScanMedia);
router.post('/:scanId/reviewed', protect, markRoomScanReviewed);
module.exports = router;
