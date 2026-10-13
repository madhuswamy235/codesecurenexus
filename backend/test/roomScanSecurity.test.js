const test = require('node:test');
const assert = require('node:assert/strict');
const { hashToken, tokenExpiry } = require('../src/controllers/roomScanController');

test('room scan tokens are stored as one-way SHA-256 hashes', () => {
  const first = hashToken('candidate-scan-token');
  assert.equal(first, hashToken('candidate-scan-token'));
  assert.notEqual(first, hashToken('different-token'));
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('room scan expiry rejects expired links', () => {
  assert.equal(tokenExpiry({ expiresAt: new Date(Date.now() - 1000) }), true);
  assert.equal(tokenExpiry({ expiresAt: new Date(Date.now() + 60_000) }), false);
});
