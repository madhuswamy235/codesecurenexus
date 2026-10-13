
const path = require('path');
// Support both `cd backend && npm run dev` and starting the server from the
// repository root. Local backend values take precedence over root values.
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/database');
const { initSocket } = require('./socket/socketServer');
const { seedDemoUsers, seedDemoAssessment, seedInitialRecruiter } = require('./utils/seedDemo');

const PORT = process.env.PORT || 5000;

// Create the HTTP server around the Express app
const server = http.createServer(app);

// Attach Socket.IO for real-time collaboration and authenticated server broadcasts.
app.set('io', initSocket(server));

// Fail loudly and clearly instead of crashing with an unhandled 'error' event.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error('   Another SecureNexus backend may already be running.');
    console.error('   Stop it first, then run: npm run dev\n');
    process.exit(1);
  }
  console.error('\n❌ Server failed to start:', err.message);
  process.exit(1);
});

// Establish persistent storage before accepting traffic. Production refuses to
// run on memory/file storage and never creates public demo credentials.
(async function boot() {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('REPLACE_WITH'))) {
    throw new Error('Set JWT_SECRET to a random value of at least 32 characters before production startup.');
  }

  const connected = await connectDB();
  if (process.env.NODE_ENV === 'production') {
    if (!connected) throw new Error('MongoDB is required in production; startup aborted.');
    await seedInitialRecruiter();
  } else {
    await seedDemoUsers();
    await seedDemoAssessment(); // demo assessment data (idempotent)
  }

  server.listen(PORT, () => {
    console.log(`✅ SecureNexus server is running on http://localhost:${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/api/health`);
  });
})().catch((err) => {
  console.error('❌ Backend startup failed:', err && err.message ? err.message : err);
  process.exit(1);
});
