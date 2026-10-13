const VALID_ROLES = ['admin', 'recruiter', 'interviewer', 'candidate'];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TAGS = 6;

function finiteNumber(value) {
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function asTime(value) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function getId(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'object' && value._id !== undefined && value._id !== null) return String(value._id);
  if (typeof value === 'object' && typeof value.toHexString === 'function') return value.toHexString();
  return String(value);
}

function isQuestionLevelSubmission(row) {
  return Boolean(
    row &&
    ['submitted', 'evaluated'].includes(row.status) &&
    ['MCQ', 'CODING'].includes(row.type) &&
    row.questionId !== undefined &&
    row.questionId !== null
  );
}

function isQuestionScore(row) {
  if (!isQuestionLevelSubmission(row) || row.status !== 'evaluated') return false;
  const score = finiteNumber(row.score);
  const maxScore = finiteNumber(row.maxScore);
  return score !== null && maxScore !== null && maxScore > 0 && score >= 0 && score <= maxScore;
}

function scorePercent(rows) {
  if (!rows.length) return null;
  const totalScore = rows.reduce((total, row) => total + Number(row.score), 0);
  const totalMaxScore = rows.reduce((total, row) => total + Number(row.maxScore), 0);
  if (!Number.isFinite(totalScore) || !Number.isFinite(totalMaxScore) || totalMaxScore <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((totalScore / totalMaxScore) * 100)));
}

function deriveDashboardMetrics({
  users = [],
  interviews = [],
  submissions = [],
  questions = [],
  criticalSecurityEvents = [],
  now = new Date(),
} = {}) {
  const nowTime = asTime(now) ?? Date.now();
  const weekStart = nowTime - WEEK_MS;
  const questionById = new Map(questions.map((question) => [getId(question._id || question.id), question]));
  const eligibleQuestionSubmissions = submissions.filter(isQuestionLevelSubmission);
  const scoredQuestions = eligibleQuestionSubmissions.filter(isQuestionScore);
  const codingQuestions = scoredQuestions.filter((submission) => submission.type === 'CODING');
  const tags = new Map();

  for (const submission of scoredQuestions) {
    const question = questionById.get(getId(submission.questionId));
    const questionTags = Array.isArray(question?.tags) ? question.tags : [];
    for (const value of questionTags) {
      if (typeof value !== 'string') continue;
      const tag = value.trim();
      if (!tag) continue;
      const score = tags.get(tag) || { score: 0, maxScore: 0, evaluatedCount: 0 };
      score.score += Number(submission.score);
      score.maxScore += Number(submission.maxScore);
      score.evaluatedCount += 1;
      tags.set(tag, score);
    }
  }

  const performanceByTag = [...tags.entries()]
    .map(([tag, score]) => ({
      tag,
      scorePercent: scorePercent([{ score: score.score, maxScore: score.maxScore }]),
      evaluatedCount: score.evaluatedCount,
    }))
    .filter((metric) => metric.scorePercent !== null)
    .sort((left, right) => right.evaluatedCount - left.evaluatedCount || left.tag.localeCompare(right.tag))
    .slice(0, MAX_TAGS);

  const interviewsInLastWeek = interviews.filter((interview) => {
    const createdAt = asTime(interview.createdAt);
    return createdAt !== null && createdAt >= weekStart && createdAt <= nowTime;
  });
  const scoredQuestionsInLastWeek = scoredQuestions.filter((submission) => {
    const scoredAt = asTime(submission.submittedAt) ?? asTime(submission.updatedAt) ?? asTime(submission.createdAt);
    return scoredAt !== null && scoredAt >= weekStart && scoredAt <= nowTime;
  });
  const criticalEventsInLastWeek = criticalSecurityEvents.filter((event) => {
    const occurredAt = asTime(event.timestamp) ?? asTime(event.createdAt);
    return occurredAt !== null && occurredAt >= weekStart && occurredAt <= nowTime;
  });

  const byRole = VALID_ROLES.map((role) => ({
    role,
    count: users.filter((user) => user.role === role).length,
  }));
  const completed = interviews.filter((interview) => String(interview.status || '').toLowerCase() === 'completed').length;
  const live = interviews.filter((interview) => ['live', 'active'].includes(String(interview.status || '').toLowerCase())).length;
  const scheduled = interviews.filter((interview) => String(interview.status || '').toLowerCase() === 'scheduled').length;

  return {
    users: { total: users.length, byRole },
    interviews: {
      total: interviews.length,
      scheduled,
      live,
      completed,
    },
    assessment: {
      eligibleQuestionCount: eligibleQuestionSubmissions.length,
      evaluationRatePercent: eligibleQuestionSubmissions.length
        ? Math.round((eligibleQuestionSubmissions.filter((row) => row.status === 'evaluated').length / eligibleQuestionSubmissions.length) * 100)
        : null,
      evaluatedQuestionCount: eligibleQuestionSubmissions.filter((row) => row.status === 'evaluated').length,
      scoredQuestionCount: scoredQuestions.length,
      scorePercent: scorePercent(scoredQuestions),
      codingScorePercent: scorePercent(codingQuestions),
      performanceByTag,
    },
    communicationScorePercent: null,
    communicationUnavailableReason: 'No validated communication score is available.',
    security: { criticalEvents: criticalSecurityEvents.length },
    weekly: {
      interviewsCreated: interviewsInLastWeek.length,
      questionsScored: scoredQuestionsInLastWeek.length,
      criticalEvents: criticalEventsInLastWeek.length,
    },
  };
}

module.exports = { deriveDashboardMetrics, isQuestionScore, scorePercent };
