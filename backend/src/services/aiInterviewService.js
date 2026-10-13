const { analyzeResponse, aiStatus } = require('./aiService');

const FALLBACK_QUESTIONS = [
  ['Technical', 'Explain the difference between an array and a linked list.'],
  ['DSA', 'Describe an approach for finding a pair of values that sums to a target.'],
  ['Computer Science', 'What is the purpose of database indexing, and what trade-off does it introduce?'],
  ['Project', 'Explain how your SecureNexus project detects suspicious interview behavior.'],
  ['Behavioral', 'Tell me about a difficult engineering decision and how you communicated it.'],
];

function questionFor(index, role, topics) {
  const [category, question] = FALLBACK_QUESTIONS[index % FALLBACK_QUESTIONS.length];
  const topic = Array.isArray(topics) && topics[index % topics.length];
  return {
    questionId: `q${index + 1}`,
    category,
    question: topic ? `${question} Relate your answer to ${topic}.` : question,
    role,
    mode: 'deterministic-fallback',
  };
}

async function evaluateAnswer({ answer, question, category }) {
  const text = String(answer || '').trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const sentences = text.split(/[.!?]+/).filter((part) => part.trim()).length;
  const keywords = String(question || '').toLowerCase().split(/\W+/).filter((word) => word.length > 4);
  const matches = keywords.filter((word) => text.toLowerCase().includes(word)).length;
  const relevance = Math.min(100, 35 + matches * 12 + Math.min(words, 40));
  const communication = Math.min(100, 35 + Math.min(words, 55) + sentences * 7);
  const technical = Math.min(100, 30 + matches * 10 + Math.min(words, 45));
  const confidence = Math.min(100, 30 + Math.min(words, 60) + (sentences >= 2 ? 10 : 0));
  const overall = Math.round((technical + relevance + communication + confidence) / 4);
  const analysis = await analyzeResponse({ text, type: category });
  const strengths = [];
  const weaknesses = [];
  if (relevance >= 65) strengths.push('Answer addresses the question directly.');
  else weaknesses.push('Connect the explanation more directly to the question.');
  if (communication >= 65) strengths.push('Answer has useful structure and detail.');
  else weaknesses.push('Use a clearer structure with an example or conclusion.');
  return {
    technicalScore: Math.round(technical), relevanceScore: Math.round(relevance),
    communicationScore: Math.round(communication), confidenceScore: Math.round(confidence),
    overallScore: overall, strengths, weaknesses,
    feedback: analysis.suggestion || 'Give a concise explanation and support it with a concrete example.',
    mode: aiStatus().configured ? 'provider-boundary' : 'deterministic-fallback',
  };
}

module.exports = { questionFor, evaluateAnswer };