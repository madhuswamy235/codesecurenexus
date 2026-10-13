const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { ok } = require('../utils/response');

const router = express.Router();

const DEFAULT_STUN_SERVER = { urls: 'stun:stun.l.google.com:19302' };

function configuredTurnServer() {
  const urls = String(process.env.TURN_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const username = String(process.env.TURN_USERNAME || '').trim();
  const credential = String(process.env.TURN_CREDENTIAL || '').trim();

  if (!urls.length || !username || !credential) return null;
  return { urls, username, credential };
}

/** Returns authorized-client ICE configuration without exposing server env values. */
router.get('/ice-servers', protect, (req, res) => {
  const turn = configuredTurnServer();
  return ok(res, {
    iceServers: [DEFAULT_STUN_SERVER, ...(turn ? [turn] : [])],
    turnConfigured: Boolean(turn),
    warning: turn ? null : 'TURN is not configured; restrictive NAT environments may require a TURN server.',
  });
});

module.exports = router;
