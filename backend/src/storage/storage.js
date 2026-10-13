/* eslint-disable no-console */
/**
 * Generic storage abstraction.
 *
 * Controllers never talk to Mongoose directly. They call
 *   store.collection('users').findOne(...) / insertOne(...) / etc.
 *
 * When MongoDB is connected the calls are proxied to Mongoose models.
 * When it is not, calls are proxied to the DEVELOPMENT/DEMO JSON-file store.
 */
const fs = require('fs');
const path = require('path');
const { isMongoConnected, getDbState } = require('../config/database');
const { newId } = require('../utils/id');

const DATA_DIR = path.join(__dirname, '..', '..', '.dev-data');

/* ---------------- FILE STORAGE IMPLEMENTATION ---------------- */

function ensureFile(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify([], null, 2));
  }
  return file;
}

function readAll(name) {
  try {
    const file = ensureFile(name);
    const raw = fs.readFileSync(file, 'utf8');
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch (err) {
    return [];
  }
}

function writeAll(name, rows) {
  const file = ensureFile(name);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2));
}

/** Mini matcher: supports equality (by value) and _id matching. */
function matchRow(row, query) {
  return Object.keys(query || {}).every((key) => {
    if (key === '_id') {
      return String(row._id || row.id) === String(query[key]);
    }
    if (query[key] === undefined) return true;
    if (query[key] && Array.isArray(query[key])) {
      return query[key].some((v) => String(row[key]) === String(v));
    }
    return String(row[key]) === String(query[key]);
  });
}

/** Applies $set, $inc, $push, $pull style updates to a plain row. */
function applyUpdate(row, update) {
  const result = { ...row };
  if (update.$set) Object.assign(result, update.$set);
  if (update.$inc) {
    Object.keys(update.$inc).forEach((k) => {
      result[k] = (result[k] || 0) + update.$inc[k];
    });
  }
  if (update.$push) {
    Object.keys(update.$push).forEach((k) => {
      if (result[k] && Array.isArray(result[k])) result[k].push(update.$push[k]);
      else result[k] = [update.$push[k]];
    });
  }
  if (update.$pull) {
    Object.keys(update.$pull).forEach((k) => {
      if (Array.isArray(result[k])) {
        result[k] = result[k].filter((item) => {
          if (typeof update.$pull[k] === 'object') {
            return !matchRow(item, update.$pull[k]);
          }
          return String(item) !== String(update.$pull[k]);
        });
      }
    });
  }
  return result;
}

function createFileCollection(name) {
  return {
    async insertOne(doc) {
      const rows = readAll(name);
      const record = {
        _id: newId(name),
        ...doc,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      rows.push(record);
      writeAll(name, rows);
      return record;
    },

    async findOne(query) {
      const rows = readAll(name);
      return rows.find((r) => matchRow(r, query)) || null;
    },

    async findById(id) {
      const rows = readAll(name);
      return rows.find((r) => String(r._id || r.id) === String(id)) || null;
    },

    async find(query, opts = {}) {
      let rows = readAll(name).filter((r) => matchRow(r, query || {}));
      if (opts.sort && typeof opts.sort === 'object') {
        const [k, dir] = Object.entries(opts.sort)[0];
        rows.sort((a, b) =>
          (dir === -1 ? -1 : 1) *
          String(a[k] || '').localeCompare(String(b[k] || ''))
        );
      }
      if (opts.limit) rows = rows.slice(0, opts.limit);
      return rows;
    },

    async count(query) {
      return readAll(name).filter((r) => matchRow(r, query || {})).length;
    },

    async updateById(id, update) {
      const rows = readAll(name);
      const idx = rows.findIndex((r) => String(r._id || r.id) === String(id));
      if (idx === -1) return null;
      rows[idx] = { ...applyUpdate(rows[idx], update), updatedAt: new Date().toISOString() };
      writeAll(name, rows);
      return rows[idx];
    },

    async updateOne(query, update) {
      const rows = readAll(name);
      const idx = rows.findIndex((r) => matchRow(r, query));
      if (idx === -1) return null;
      rows[idx] = { ...applyUpdate(rows[idx], update), updatedAt: new Date().toISOString() };
      writeAll(name, rows);
      return rows[idx];
    },

    async deleteById(id) {
      const rows = readAll(name);
      const idx = rows.findIndex((r) => String(r._id || r.id) === String(id));
      if (idx === -1) return false;
      rows.splice(idx, 1);
      writeAll(name, rows);
      return true;
    },

    async deleteMany(query) {
      const remaining = readAll(name).filter((r) => !matchRow(r, query || {}));
      writeAll(name, remaining);
      return true;
    },
  };
}

/* ---------------- MONGOOSE (MODEL) ADAPTER ---------------- */

function createMongoCollection(Model) {
  return {
    async insertOne(doc) {
      const record = await Model.create(doc);
      return record.toObject ? record.toObject() : record;
    },

    async findOne(query) {
      const record = await Model.findOne(query || {}).lean().catch(() => null);
      return record;
    },

    async findById(id) {
      const record = await Model.findById(id).lean().catch(() => null);
      return record;
    },

    async find(query, opts = {}) {
      let q = Model.find(query || {});
      if (opts.sort) q = q.sort(opts.sort);
      if (opts.limit) q = q.limit(opts.limit);
      const rows = await q.lean().catch(() => []);
      return rows || [];
    },

    async count(query) {
      return Model.countDocuments(query || {}).catch(() => 0);
    },

    async updateById(id, update) {
      const record = await Model.findByIdAndUpdate(id, update, { new: true })
        .lean()
        .catch(() => null);
      return record;
    },

    async updateOne(query, update) {
      const record = await Model.findOneAndUpdate(query, update, { new: true })
        .lean()
        .catch(() => null);
      return record;
    },

    async deleteById(id) {
      await Model.findByIdAndDelete(id).catch(() => null);
      return true;
    },

    async deleteMany(query) {
      await Model.deleteMany(query || {}).catch(() => null);
      return true;
    },
  };
}

/* ---------------- COLLECTION REGISTRY ---------------- */

const cache = new Map();

/**
 * Returns a collection abstraction whose ADAPTER IS RESOLVED AT CALL TIME.
 *
 * PHASE 2B STORAGE BUG FIX:
 * Controllers call `collection('users', User)` ONCE at module-require time, and
 * keep the returned reference for the life of the process. The old code chose
 * the adapter (file vs Mongo) at that first call and cached it forever. Because
 * require-time runs BEFORE the async connectDB() in server.js resolves, every
 * collection was permanently bound to the file adapter even after MongoDB
 * connected. Result: real data silently went to file storage while getMode()
 * and /api/health claimed "mongodb" — a genuine split-brain storage bug.
 *
 * Fix: return a DISPATCHING FACADE. Every method checks isMongoConnected() at
 * call time and forwards to the live Mongo adapter (when connected and a Model
 * is registered) or to the file adapter otherwise. The connection state can no
 * longer become stale, and reads/writes always target the real back end.
 */
const METHODS = [
  'insertOne', 'findOne', 'findById', 'find', 'count',
  'updateById', 'updateOne', 'deleteById', 'deleteMany',
];

function collection(name, Model) {
  const key = name;

  let facade = cache.get(key);
  if (facade) return facade;

  const fileCol = createFileCollection(name);
  const mongoCol = Model ? createMongoCollection(Model) : null;

  // Production must never silently route durable data to demo files.
  function resolve() {
    if (mongoCol && isMongoConnected()) return mongoCol;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`MongoDB is required in production; refusing file storage for collection "${name}".`);
    }
    return fileCol;
  }

  facade = {};
  for (const m of METHODS) {
    facade[m] = (...args) => resolve()[m](...args);
  }
  // Keep a stable object identity for call sites that may compare references.
  cache.set(key, facade);
  return facade;
}

/** Returns "mongodb" or "file" so consumers can be transparent. */
function getMode() {
  return getDbState().mode;
}

module.exports = { collection, getMode };