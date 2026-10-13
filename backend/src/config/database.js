const mongoose = require('mongoose');
const dns = require('dns');
const logger = require('../utils/logger');

// Fix for "querySrv ECONNREFUSED" on Windows where Node.js's built-in
// c-ares resolver fails against the system DNS for SRV lookups.
// This must be set BEFORE mongoose resolves the SRV records, so we assign it
// at module load. (Verified: without this, Atlas 'mongodb+srv://' URIs fail
// with querySrv ECONNREFUSED even when the network is fine.)
dns.setServers(['8.8.8.8', '1.1.1.1']);

let mongooseConnected = false;
let memoryMongoServer = null;

async function resolveMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MONGODB_URI is required in production. Configure MongoDB Atlas before starting the backend.');
  }

  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryMongoServer = await MongoMemoryServer.create({
      binary: { version: '7.0.14' },
      instance: { dbName: 'securenexus' },
    });
    const uri = memoryMongoServer.getUri();
    process.env.MONGODB_URI = uri;
    logger.info('✅ Local MongoDB memory server started for development');
    return uri;
  } catch (err) {
    logger.warn('⚠️  MONGODB_URI not set and local MongoDB memory server could not start');
    logger.warn(`   (${err && err.message ? err.message : err})`);
    return null;
  }
}

/**
 * Attempts to connect to MongoDB.
 * IMPORTANT: On failure the server does NOT crash. The application keeps
 * running and the storage layer transparently falls back to an in-memory /
 * JSON-file store which is clearly marked as DEVELOPMENT/DEMO storage.
 */
async function connectDB() {
  const uri = await resolveMongoUri();
  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MongoDB is required in production; refusing to start with demo storage.');
    }
    logger.warn('⚠️  MongoDB unavailable -> using DEVELOPMENT/DEMO file storage');
    return false;
  }

  try {
    // Re-assert the DNS servers so the driver's SRV lookup uses them even if
    // another module reset the resolver before this ran.
    try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (_e) { /* noop */ }

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 20000,
      connectTimeoutMS: 20000,
    });
    mongooseConnected = true;
    logger.info('✅ MongoDB Connected Successfully');
  } catch (err) {
    mongooseConnected = false;
    if (process.env.NODE_ENV === 'production') {
      logger.error('MongoDB connection failed in production; refusing to use demo storage.');
      throw new Error('MongoDB connection failed. Check the Atlas URI, database user, and network access configuration.');
    }
    logger.warn('⚠️  MongoDB unavailable -> using DEVELOPMENT/DEMO file storage');
    logger.warn(`   (${err.message})`);
    suggestMongoFix(err, uri);
  }

  return mongooseConnected;
}

/**
 * Prints a clear, actionable hint based on the exact failure so the developer
 * knows whether the problem is their Atlas whitelist, DNS, or the URI itself.
 */
function suggestMongoFix(err, uri) {
  const msg = String((err && err.message) || err || '').toLowerCase();
  const plainUri = String(uri || '').replace(/\/\/[^@]+@/, '//<credentials>@');

  if (msg.includes('whitelist') || msg.includes('not authorized') || msg.includes('authentication failed')) {
    logger.warn('\n   >> CAUSE: MongoDB Atlas rejected the connection.');
    logger.warn('   >> FIX (Atlas console): Network Access -> Add Your Current IP Address,');
    logger.warn('      or choose "Allow access from anywhere" (0.0.0.0/0) for development.');
    logger.warn(`   >> URI in use: ${plainUri}`);
  } else if (msg.includes('querysrv') || msg.includes('econnrefused') || msg.includes('getaddrinfo')) {
    logger.warn('\n   >> CAUSE: DNS / SRV lookup failed for the Atlas cluster.');
    logger.warn('   >> FIX: ensure you are online and the cluster is running; verify the');
    logger.warn('      host in the connection string. If DNS keeps failing on Windows,');
    logger.warn(`      the recommended fix (dns.setServers) is already applied in database.js.`);
  } else if (msg.includes('bad auth') || msg.includes('bad username')) {
    logger.warn('\n   >> CAUSE: Credentials in the connection string are incorrect.');
    logger.warn(`   >> FIX: check the username/password in backend/.env (MONGODB_URI).`);
  } else if (msg.includes('enotfound')) {
    logger.warn('\n   >> CAUSE: Atlas hostname could not be resolved.');
    logger.warn('   >> FIX: check the cluster name in MONGODB_URI.');
  } else {
    logger.warn('\n   >> The file-storage fallback remains active, so the application keeps working.');
    logger.warn(`   >> Mongo URI in use: ${plainUri}`);
  }
  logger.warn('   (Continue with DEVELOPMENT/DEMO file storage, or whitelist/local-Mongo to use a real DB.)\n');
}

function isMongoConnected() {
  return mongooseConnected;
}

/**
 * Returns a SYNCHRONOUS connection status for /api/health.
 */
function getDbState() {
  const memoryDatabase = mongooseConnected && Boolean(memoryMongoServer);
  return {
    connected: mongooseConnected,
    mode: memoryDatabase ? 'mongodb-memory' : mongooseConnected ? 'mongodb' : 'file',
    label: memoryDatabase
      ? 'EPHEMERAL MEMORY MONGODB (data is lost on restart)'
      : mongooseConnected
        ? 'MongoDB Connected'
        : 'DEVELOPMENT/DEMO FILE STORAGE (MongoDB not connected)',
  };
}

module.exports = { connectDB, isMongoConnected, getDbState };

