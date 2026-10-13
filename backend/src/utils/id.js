const crypto = require('crypto');

/** Generates a lightweight unique ID (used by the dev/file storage). */
function newId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(6).toString('hex')}`;
}

module.exports = { newId };