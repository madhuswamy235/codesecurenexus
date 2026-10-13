const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeFaceCountDetails,
  normalizeNearbyDeviceDetails,
  normalizeEventType,
  summaryFromRows,
  canAccessSecurityInterview,
  shouldEscalateRepeatedTabSwitches,
} = require('../src/controllers/securityController');
const { connectDB } = require('../src/config/database');
const { collection } = require('../src/storage/storage');

const now = new Date('2026-10-05T12:00:00.000Z');

 test('accepts only bounded integer multiple-face counts', () => {
  assert.deepEqual(normalizeFaceCountDetails({ faceCount: 2, frame: 'discarded' }), { faceCount: 2 });
  assert.deepEqual(normalizeFaceCountDetails({ faceCount: 20 }), { faceCount: 20 });
  for (const invalid of [undefined, null, {}, { faceCount: 1 }, { faceCount: 21 }, { faceCount: 2.5 }, { faceCount: '2' }]) {
    assert.equal(normalizeFaceCountDetails(invalid), null);
  }
});

test('bounds Bluetooth LE advertising-signal count and discards identifiers', () => {
  assert.deepEqual(normalizeNearbyDeviceDetails({ nearbyDeviceCount: 4, addresses: ['private'] }), { nearbyDeviceCount: 4 });
  assert.deepEqual(normalizeNearbyDeviceDetails({ nearbyDeviceCount: 100 }), { nearbyDeviceCount: 100 });
  for (const invalid of [undefined, null, {}, { nearbyDeviceCount: 0 }, { nearbyDeviceCount: 101 }, { nearbyDeviceCount: 2.5 }, { nearbyDeviceCount: '4' }]) {
    assert.equal(normalizeNearbyDeviceDetails(invalid), null);
  }
});

test('accepts the persisted multi-face and server warning event types', () => {
  assert.equal(normalizeEventType('MULTIPLE_FACE_DETECTED'), 'MULTIPLE_FACE_DETECTED');
  assert.equal(normalizeEventType('SUSPICIOUS_ACTIVITY'), 'SUSPICIOUS_ACTIVITY');
});

test('authorizes security data only for interview participants or invited candidate email', () => {
  const interview = {
    _id: 'interview-1',
    recruiterId: 'recruiter-1',
    candidateId: 'candidate-1',
    interviewerId: 'interviewer-1',
    createdBy: 'recruiter-1',
    candidateEmail: 'invite@example.com',
  };
  assert.equal(canAccessSecurityInterview({ _id: 'recruiter-1', role: 'recruiter' }, interview), true);
  assert.equal(canAccessSecurityInterview({ _id: 'candidate-1', role: 'candidate' }, interview), true);
  assert.equal(canAccessSecurityInterview({ _id: 'stranger', role: 'candidate' }, interview), false);
  assert.equal(canAccessSecurityInterview({ _id: 'candidate-invite', role: 'candidate', email: 'invite@example.com' }, { candidateEmail: 'invite@example.com' }, {}), true);
  assert.equal(canAccessSecurityInterview({ _id: 'candidate-other', role: 'candidate', email: 'elsewhere@example.com' }, { candidateEmail: 'invite@example.com' }, {}), false);
});

test('flags a suspicious-activity signal after three tab switches in one minute once only', () => {
  const at = new Date(now.getTime() - 10_000);
  const events = [1, 2, 3].map((index) => ({ eventType: 'TAB_SWITCH', timestamp: new Date(at.getTime() + index * 1000) }));
  assert.equal(shouldEscalateRepeatedTabSwitches(events.slice(0, 2), now), 0);
  assert.equal(shouldEscalateRepeatedTabSwitches(events, now), 3);
  assert.equal(shouldEscalateRepeatedTabSwitches([
    ...events,
    { eventType: 'SUSPICIOUS_ACTIVITY', timestamp: now, metadata: { rule: 'repeated-tab-switches' } },
  ], now), 0);
  assert.equal(shouldEscalateRepeatedTabSwitches(events.map((event) => ({ ...event, timestamp: new Date(now.getTime() - 90_000) })), now), 0);
});

test('counts face review incidents without adding them to risk score', () => {
  const summary = summaryFromRows([
    { eventType: 'MULTIPLE_FACE_DETECTED', severity: 'MEDIUM', details: { faceCount: 3 } },
    { eventType: 'MULTIPLE_FACE_DETECTED', severity: 'MEDIUM', details: { faceCount: 2 } },
  ]);
  assert.equal(summary.multipleFaceIncidentCount, 2);
  assert.equal(summary.securityScore, 100);
});

test('counts repeated tab-switch alerts and exposes suspicious activity totals', () => {
  const summary = summaryFromRows([
    { eventType: 'TAB_SWITCH' },
    { eventType: 'TAB_SWITCH' },
    { eventType: 'TAB_SWITCH' },
    { eventType: 'SUSPICIOUS_ACTIVITY' },
    { eventType: 'NEARBY_DEVICE_DETECTED', metadata: { nearbyDeviceCount: 3 } },
  ]);
  assert.equal(summary.tabSwitchCount, 3);
  assert.equal(summary.suspiciousActivityCount, 1);
  assert.equal(summary.nearbyDeviceCount, 3);
  assert.equal(summary.securityStatus, 'HIGH_RISK');
});

test('production requires a configured MongoDB connection', async () => {
  const previousMode = process.env.NODE_ENV;
  const previousUri = process.env.MONGODB_URI;
  process.env.NODE_ENV = 'production';
  delete process.env.MONGODB_URI;
  try {
    await assert.rejects(connectDB(), /MONGODB_URI is required in production/);
  } finally {
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
  }
});

test('production collections refuse demo file storage', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const probe = collection('production-storage-guard-test');
    assert.throws(() => probe.findOne({}), /MongoDB is required in production/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
