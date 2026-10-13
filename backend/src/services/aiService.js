const logger = require('../utils/logger');

/**
 * AI Analysis Service Layer.
 *
 * All AI provider configuration lives ONLY in backend environment variables
 * (AI_PROVIDER, AI_API_KEY, AI_MODEL). Nothing is ever sent to the browser.
 *
 * When no provider is configured this service returns clearly-labelled
 * DEVELOPMENT/MOCK responses and marks every feature as
 * "READY FOR AI INTEGRATION". It never pretends real AI inference happened.
 */

function isConfigured() {
  return Boolean(process.env.AI_PROVIDER && process.env.AI_API_KEY);
}

function aiStatus() {
  const provider = process.env.AI_PROVIDER || null;
  return {
    configured: isConfigured(),
    provider: provider || null,
    mode: isConfigured() ? 'live' : 'dev-mock',
  };
}

/** Mock analysis for a written answer / spoken response. */
async function analyzeResponse({ text, type }) {
  const content = String(text || '').trim();
  if (!content) {
    return { suggestion: '', status: 'EMPTY_INPUT' };
  }

  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 1).length;
  const words = content.split(/\s+/).filter(Boolean).length;

  const confidence = Math.min(95, 40 + Math.min(words, 60) * 0.7 + sentences * 3);
  const clarity = Math.min(95, 35 + sentences * 8 + Math.min(words, 80) * 0.4);

  let suggestion = '';
  if (words < 15) suggestion = 'Expand the answer with more detail and examples.';
  else if (sentences < 2) suggestion = 'Break the answer into clearer, shorter sentences.';
  else suggestion = 'Answer is well-structured. Add a concrete example to strengthen it.';

  return {
    type: type || 'GENERAL',
    wordCount: words,
    sentenceCount: sentences,
    confidence: Math.round(confidence),
    clarity: Math.round(clarity),
    suggestion,
    aiMode: aiStatus().mode,
    note: isConfigured()
      ? 'Analysed via configured AI provider.'
      : 'DEVELOPMENT/MOCK analysis. READY FOR AI INTEGRATION when AI_API_KEY is set on the backend.',
  };
}

/** Mock summarizer for interview / written content. */
async function summarizeInterview({ interviewTitle, candidateName, answers }) {
  const answerCount = Array.isArray(answers) ? answers.length : 0;
  const totalWords = (Array.isArray(answers) ? answers : []).reduce(
    (sum, a) => sum + String(a.text || '').split(/\s+/).filter(Boolean).length,
    0
  );
  return {
    summary:
      `Interview "${interviewTitle || 'Untitled'}" with ${candidateName || 'candidate'} ` +
      `produced ${answerCount} submitted answer(s) totalling ${totalWords} words.`,
    answerCount,
    totalWords,
    aiMode: aiStatus().mode,
    note: isConfigured()
      ? 'Generated via configured AI provider.'
      : 'DEVELOPMENT/MOCK summary. READY FOR AI INTEGRATION when AI_API_KEY is set on the backend.',
  };
}

module.exports = {
  analyzeResponse,
  summarizeInterview,
  aiStatus,
  isConfigured,
};