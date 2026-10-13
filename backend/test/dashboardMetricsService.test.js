const test = require('node:test');
const assert = require('node:assert/strict');
const { deriveDashboardMetrics, isQuestionScore, scorePercent } = require('../src/services/dashboardMetricsService');

const now = new Date('2026-10-05T12:00:00.000Z');

test('derives percentages only from valid evaluated question-level scores', () => {
  const stats = deriveDashboardMetrics({
    now,
    submissions: [
      { status: 'evaluated', type: 'MCQ', questionId: 'q1', score: 8, maxScore: 10 },
      { status: 'evaluated', type: 'CODING', questionId: 'q2', score: 6, maxScore: 10 },
      { status: 'evaluated', type: 'MCQ', questionId: null, score: 80, maxScore: 100 }, // legacy aggregate row
      { status: 'submitted', type: 'FINAL', questionId: null, score: 80, maxScore: 100 },
      { status: 'evaluated', type: 'CODING', questionId: 'q3', score: 12, maxScore: 10 }, // invalid range
      { status: 'submitted', type: 'CODING', questionId: 'q4', score: 0, maxScore: 10 },
    ],
  });

  assert.equal(stats.assessment.evaluationRatePercent, 75);
  assert.equal(stats.assessment.evaluatedQuestionCount, 3);
  assert.equal(stats.assessment.scoredQuestionCount, 2);
  assert.equal(stats.assessment.scorePercent, 70);
  assert.equal(stats.assessment.codingScorePercent, 60);
  assert.equal(stats.communicationScorePercent, null);
});

test('returns unavailable for empty denominators and rejects invalid score rows', () => {
  assert.equal(scorePercent([]), null);
  assert.equal(scorePercent([{ score: 1, maxScore: 0 }]), null);
  for (const row of [
    null,
    { status: 'saved', type: 'MCQ', questionId: 'q1', score: 0, maxScore: 10 },
    { status: 'evaluated', type: 'FINAL', questionId: 'q1', score: 10, maxScore: 10 },
    { status: 'evaluated', type: 'MCQ', questionId: null, score: 10, maxScore: 10 },
    { status: 'evaluated', type: 'CODING', questionId: 'q1', score: -1, maxScore: 10 },
    { status: 'evaluated', type: 'CODING', questionId: 'q1', score: 1, maxScore: 'invalid' },
  ]) assert.equal(isQuestionScore(row), false);
});

test('bounds valid percentages in the inclusive zero-to-one-hundred range', () => {
  assert.equal(scorePercent([{ score: 0, maxScore: 10 }]), 0);
  assert.equal(scorePercent([{ score: 10, maxScore: 10 }]), 100);
});

test('derives tag and rolling-seven-day counts from persisted timestamps', () => {
  const stats = deriveDashboardMetrics({
    now,
    users: [{ role: 'recruiter' }, { role: 'candidate' }],
    interviews: [
      { status: 'completed', createdAt: '2026-10-04T10:00:00.000Z' },
      { status: 'active', createdAt: '2026-09-20T10:00:00.000Z' },
    ],
    questions: [{ _id: 'q1', tags: ['algorithms', '  '] }, { _id: 'q2', tags: ['systems'] }],
    submissions: [
      { status: 'evaluated', type: 'MCQ', questionId: 'q1', score: 8, maxScore: 10, submittedAt: '2026-10-04T11:00:00.000Z' },
      { status: 'evaluated', type: 'CODING', questionId: 'q2', score: 3, maxScore: 5, submittedAt: '2026-09-27T11:00:00.000Z' },
    ],
    criticalSecurityEvents: [
      { createdAt: '2026-10-01T10:00:00.000Z' },
      { createdAt: '2026-09-20T10:00:00.000Z' },
    ],
  });

  assert.deepEqual(stats.users, {
    total: 2,
    byRole: [
      { role: 'admin', count: 0 },
      { role: 'recruiter', count: 1 },
      { role: 'interviewer', count: 0 },
      { role: 'candidate', count: 1 },
    ],
  });
  assert.deepEqual(stats.interviews, { total: 2, scheduled: 0, live: 1, completed: 1 });
  assert.deepEqual(stats.assessment.performanceByTag, [
    { tag: 'algorithms', scorePercent: 80, evaluatedCount: 1 },
    { tag: 'systems', scorePercent: 60, evaluatedCount: 1 },
  ]);
  assert.deepEqual(stats.weekly, { interviewsCreated: 1, questionsScored: 1, criticalEvents: 1 });
  assert.equal(stats.security.criticalEvents, 2);
});

test('event totals cannot become communication percentages', () => {
  const stats = deriveDashboardMetrics({
    now,
    criticalSecurityEvents: Array.from({ length: 1273 }, () => ({ createdAt: now })),
  });
  assert.equal(stats.security.criticalEvents, 1273);
  assert.equal(stats.communicationScorePercent, null);
  assert.equal(stats.assessment.scorePercent, null);
});
