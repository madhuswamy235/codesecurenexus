/**
 * Interview service helpers: timeline of events and status transitions.
 * (Kept separate from controllers for reuse by the socket layer and reports.)
 */
const { collection, getMode } = require('../storage/storage');

async function getTimeline(interviewId, store) {
  const security = store.security || collection('securityevents');
  const events = await security.find({ interviewId }, { sort: { createdAt: -1 }, limit: 200 });
  return (events || []).map((e) => ({
    _id: e._id,
    eventType: e.eventType,
    severity: e.severity,
    details: e.details,
    timestamp: e.createdAt || e.timestamp,
  }));
}

module.exports = { getTimeline };