process.env.JWT_SECRET ||= 'test-only-jwt-secret-for-interview-authorization';

const test = require('node:test');
const assert = require('node:assert/strict');
const interviewRoutes = require('../src/routes/interviewRoutes');

function getCreateRouteMiddleware() {
  const layer = interviewRoutes.stack.find((entry) => entry.route?.path === '/' && entry.route.methods.post);
  assert.ok(layer, 'POST /api/interviews route should be registered');
  return layer.route.stack.map((entry) => entry.handle);
}

test('only recruiter-side roles pass interview creation authorization', async () => {
  const [protect, authorize] = getCreateRouteMiddleware();
  assert.equal(protect.name, 'protect');

  for (const role of ['admin', 'recruiter', 'interviewer']) {
    let passedAuthorization = false;
    let statusCode;
    const response = {
      status(code) {
        statusCode = code;
        return this;
      },
      json() {
        return this;
      },
    };

    authorize({ userRole: role }, response, () => {
      passedAuthorization = true;
    });

    assert.equal(passedAuthorization, true, `${role} should pass create authorization`);
    assert.equal(statusCode, undefined);
  }

  let candidatePassed = false;
  let candidateStatus;
  const candidateResponse = {
    status(code) {
      candidateStatus = code;
      return this;
    },
    json() {
      return this;
    },
  };
  authorize({ userRole: 'candidate' }, candidateResponse, () => {
    candidatePassed = true;
  });
  assert.equal(candidatePassed, false);
  assert.equal(candidateStatus, 403);
});

test('interview creation route still rejects unauthenticated requests', async () => {
  const [protect] = getCreateRouteMiddleware();
  let statusCode;
  let responseBody;
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  await protect({ headers: {} }, response, () => {
    assert.fail('Unauthenticated request must not reach interview creation');
  });

  assert.equal(statusCode, 401);
  assert.match(responseBody.message, /No token/);
});
