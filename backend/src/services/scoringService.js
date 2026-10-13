/**
 * Deterministic assessment scoring helpers.
 */

/** Scores an MCQ submission. correctOption is an index into options. */
function scoreMcq(question, selectedOption) {
  const max = question.maxScore || 10;
  const correctIndex = Number(question.correctOption);
  const chosen = Number(selectedOption);
  const isCorrect = correctIndex >= 0 && chosen >= 0 && correctIndex === chosen;
  return { score: isCorrect ? max : 0, maxScore: max, correct: isCorrect, correctOption: correctIndex };
}

/** Scores a batch of MCQ answers. Returns aggregate + per-question. */
function scoreMcqBatch(questions, answers) {
  let total = 0;
  let maxTotal = 0;
  const perQuestion = questions.map((question) => {
    const answer = answers.find((item) => String(item.questionId) === String(question._id));
    const chosen = answer ? Number(answer.selectedOption) : -1;
    const evaluation = scoreMcq(question, chosen);
    total += evaluation.score;
    maxTotal += evaluation.maxScore;
    return { questionId: String(question._id), selectedOption: chosen, correct: evaluation.correct, score: evaluation.score };
  });
  const percentage = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;
  return { total, maxTotal, percentage, perQuestion };
}

/** Builds a deterministic skill summary from MCQ/coding submissions. */
function buildSkillBreakdown(submissions) {
  const skills = { ai: 0, coding: 0, security: 0, communication: 0, overall: 0 };
  const counts = { ai: 0, coding: 0, security: 0, communication: 0 };
  for (const submission of submissions || []) {
    const scoreRatio = submission.maxScore > 0 ? submission.score / submission.maxScore : 0;
    if (submission.type === 'CODING') {
      skills.coding += scoreRatio;
      counts.coding += 1;
    } else if (submission.type === 'MCQ') {
      skills.ai += scoreRatio;
      skills.security += scoreRatio;
      counts.ai += 1;
      counts.security += 1;
    } else if (submission.type === 'WRITTEN') {
      skills.communication += scoreRatio;
      counts.communication += 1;
    }
  }
  const average = (key) => counts[key] > 0 ? Math.round((skills[key] / counts[key]) * 100) : 0;
  const ai = average('ai');
  const coding = average('coding');
  const security = average('security');
  const communication = average('communication');
  const evaluatedCount = counts.ai + counts.coding + counts.communication;
  const overall = evaluatedCount > 0
    ? Math.round(((skills.ai + skills.coding + skills.communication) / evaluatedCount) * 100)
    : 0;
  return { ai, coding, security, communication, overall };
}

module.exports = { scoreMcq, scoreMcqBatch, buildSkillBreakdown };
