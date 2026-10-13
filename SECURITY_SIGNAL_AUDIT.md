# SecureNexus security-signal audit

Audit date: 2026-10-13

Scope: active root Next.js application plus the `backend/` Express service. Legacy copies under `secure-nexus/`, `securenexus/`, and `securenexus-1/` are not part of the active TypeScript/ESLint project according to `tsconfig.json` and `eslint.config.mjs`.

## Verified signal pipeline

The current pipeline is:

1. Browser, local face-count hook, or the Windows proximity companion produces an event.
2. `POST /api/security/event` authenticates the user, resolves the interview/session, validates event-specific details, assigns the server severity, persists the event, and broadcasts it through Socket.IO.
3. Security timeline and summary endpoints authorize access to interview participants or the invited candidate account.
4. The client displays the timeline and summary; repeated tab switching is escalated server-side.

Relevant implementation: `backend/src/controllers/securityController.js`, `backend/src/models/SecurityEvent.js`, `hooks/useAssessmentLockdown.ts`, `hooks/useLocalFaceCount.ts`, and `backend/src/socket/socketServer.js`.

## Signal taxonomy

| Signal | Source | What it can establish | What it cannot establish | Status |
| --- | --- | --- | --- | --- |
| `CAMERA_STARTED` / `CAMERA_ENDED` | Browser media tracks | The local browser stream started or stopped | That the camera view was continuously unobstructed | PASS |
| `CAMERA_DENIED` / `CAMERA_ERROR` | `getUserMedia` failure | Permission/device/API failure was observed | Intent, cheating, or exact hardware cause in every browser | PASS |
| `CAMERA_IDLE` | Media-track state | A track became muted/ended after setup | Why it happened without additional device evidence | PASS |
| `CAMERA_OBSCURED` | Local detector after repeated no-face samples | No face was visible to the local model during the sample window | Physical obstruction, absence of the candidate, or cheating | PASS as a review indicator |
| `MULTIPLE_FACE_DETECTED` | Opt-in local MediaPipe face count | At least two faces were detected in confirmed samples | Face identity, intent, or certainty under poor lighting/occlusion | PASS as a review indicator |
| `TAB_SWITCH` / `TAB_RETURN` | `visibilitychange` | The document became hidden/visible | Which application was opened or whether assistance was used | PASS as a review indicator |
| `WINDOW_BLUR` / `WINDOW_FOCUS` | Browser window events | The window lost/regained focus | Cause, duration, or user intent | PASS as a review indicator |
| `FULLSCREEN_EXIT` | Browser fullscreen state | Fullscreen ended | Why it ended or whether another display was used | PASS as a review indicator |
| `SUSPICIOUS_ACTIVITY` | Server heuristic | Three tab switches occurred within 60 seconds, once per window | Cheating or malicious intent | PASS as a server-generated heuristic |
| `PARTICIPANT_JOINED` / `PARTICIPANT_LEFT` | Authorized Socket.IO room | A participant entered/left the authorized room | Physical presence or identity beyond the authenticated account | PASS |
| `UNEXPECTED_PARTICIPANT` | Server room/session checks | A participant violated the room/session expectation | Intent | PASS as a review signal |
| `NEARBY_DEVICE_DETECTED` | Windows proximity companion | A permissioned companion reported a bounded BLE advertising count | Device identity, owner, radio type, signal distance, or exact two-metre proximity | PARTIAL / environment-dependent |
| `FACE_REVIEW_CONSENT` | Candidate browser | Candidate enabled local face counting for the stated scope | Consent to unrelated biometric identification | PASS |

## Capabilities that must not be claimed

- Browser-only code cannot reliably identify every nearby phone/radio device or prove a device is within exactly two metres.
- A BLE advertising count is not a device identity, RSSI distance measurement, or proof that a phone belongs to the candidate.
- The face feature counts detections locally; it does not perform identity verification, biometric matching, gaze tracking, or liveness verification.
- A focus change, tab switch, no-face sample, or camera error is not itself proof of cheating.
- WebRTC signaling is available, but restrictive NAT environments still require a configured TURN service. The current fallback is STUN-only and the UI exposes that warning.

## Current module status

| Module | Status | Evidence |
| --- | --- | --- |
| Frontend lint | PASS | `npm run lint` completed successfully |
| Frontend TypeScript | PASS | `npx tsc --noEmit --pretty false` completed successfully |
| Frontend production build | PASS | `npm run build` completed; 31 App Router routes generated |
| Backend unit/security tests | PASS | `npm test` completed: 22 passed, 0 failed |
| Authentication and API authorization | PASS for covered paths | JWT middleware and security/room-scan authorization tests are present and passing |
| Security event persistence and summaries | PASS | Event normalization, severity assignment, access control, and summary tests pass |
| Room scan upload/review | PARTIAL | Consent, expiring hashed tokens, upload limits, and recruiter review flow exist; real camera permission and human review are environment-dependent |
| MongoDB persistence | PARTIAL | Production refuses demo storage; local development can fall back to file storage when MongoDB is unavailable |
| WebRTC media | PARTIAL | Signaling and cleanup exist; end-to-end media requires browser permissions, compatible devices, and TURN in restrictive networks |
| Exact nearby-device/radius detection | BLOCKED by browser/platform limits | Requires the authorized Windows companion/native integration and still cannot prove an exact radius |
| Genuine biometric/face identity verification | BLOCKED / absent | The active implementation intentionally provides local face counting only |
| Full browser E2E flow | BLOCKED in this audit | Requires a running backend, browser permissions, MongoDB or demo storage, and external service configuration where applicable |

## Commands and actual results

```text
npm run lint                         PASS
npx tsc --noEmit --pretty false      PASS
npm run build                        PASS
cd backend; npm test                 PASS (22/22)
```

No secrets or environment values were printed. The build loads `.env.local` and `.env`; production still requires a valid `JWT_SECRET` and `MONGODB_URI`.

## Remaining verification requirements

To claim end-to-end readiness, run the backend and verify `/api/health`, then manually test registration/login, role-restricted interview creation, invitation join, camera/microphone denial and recovery, assessment save/submit, security timeline/summary, Socket.IO reconnect, room-scan upload/review, and report download. Use a real MongoDB instance for persistence verification and configure TURN before testing cross-network WebRTC.

## Local demo session verified

The application is currently running locally with development file storage:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`
- Health: `/api/health` returned `db.mode: "file"` and `connected: false`.
- Recruiter demo created a `LIVE` interview and started an `ACTIVE` session.
- Candidate demo joined the generated invitation flow.
- Three candidate `TAB_SWITCH` events were persisted.
- The server generated one `SUSPICIOUS_ACTIVITY` event using the repeated-tab-switch rule.
- Verified summary: score `77`, status `WARNING`, tab switches `3`, suspicious-activity events `1`.
- The invitation page loaded and states that BLE is approximate and cannot prove a two-metre boundary.

Demo credentials are documented in `README.md` for local use only; never use them on a public deployment.
