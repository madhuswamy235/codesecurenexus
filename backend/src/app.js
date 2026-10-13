// Load env before any module that reads process.env (e.g. jwt.js)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Config / database
const { getDbState } = require('./config/database');

// Route modules
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const profileRoutes = require('./routes/profileRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const questionRoutes = require('./routes/questionRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const securityRoutes = require('./routes/securityRoutes');
const notesRoutes = require('./routes/notesRoutes');
const reportRoutes = require('./routes/reportRoutes');
const aiRoutes = require('./routes/aiRoutes');
const aiInterviewRoutes = require('./routes/aiInterviewRoutes');
const zoomRoutes = require('./routes/zoomRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const webrtcRoutes = require('./routes/webrtcRoutes');
const roomScanRoutes = require('./routes/roomScanRoutes');

// Middleware
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

const corsOrigin = (process.env.TRUSTED_CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Simple request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

/* ---------------- Health ---------------- */
app.get('/api/health', (req, res) => {
  const db = getDbState();
  res.json({
    success: true,
    message: 'SecureNexus backend is running',
    server: 'running',
    database: db.connected ? 'connected' : 'unavailable (dev/demo file storage)',
    db,
  });
});

app.get('/', (req, res) =>
  res.json({ success: true, message: '🚀 SecureNexus Backend is Running Successfully!' })
);

/* ---------------- API Routes ---------------- */
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/submissions', assessmentRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai-interview', aiInterviewRoutes);
app.use('/api/zoom', zoomRoutes);
app.use('/api/chat', realtimeRoutes);
app.use('/api/whiteboard', realtimeRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/webrtc', webrtcRoutes);
app.use('/api/room-scans', roomScanRoutes);

/* ---------------- Error handling ---------------- */
app.use(notFound);
app.use(errorHandler);

module.exports = app;
