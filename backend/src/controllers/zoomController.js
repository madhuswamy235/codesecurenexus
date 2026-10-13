const crypto = require('crypto');
const { ok, fail } = require('../utils/response');

function base64Url(value) {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signature(req, res) {
  const meetingNumber = String(req.body && req.body.meetingNumber || '').replace(/\D/g, '');
  const sdkKey = process.env.ZOOM_SDK_KEY;
  const sdkSecret = process.env.ZOOM_SDK_SECRET;
  if (!meetingNumber || meetingNumber.length < 9) return fail(res, 400, 'A valid Zoom meeting number is required');
  if (!sdkKey || !sdkSecret) return fail(res, 503, 'Zoom integration is not configured');
  const iat = Math.floor(Date.now() / 1000) - 30;
  const payload = { appKey: sdkKey, sdkKey, mn: meetingNumber, role: 0, iat, exp: iat + 60 * 60 };
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  const encoded = `${header}.${body}`;
  const signed = crypto.createHmac('sha256', sdkSecret).update(encoded).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return ok(res, { signature: `${encoded}.${signed}` });
}

module.exports = { signature };