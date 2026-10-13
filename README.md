# SecureNexus

SecureNexus is a recruiter-to-candidate interview platform with invitation links, a live WebRTC meeting, MCQ/coding assessments, an interview activity monitor, and two explainable security review models.

## Local Windows run

Prerequisites: Node.js 20.9+ and either a local MongoDB service or a MongoDB Atlas URI. MongoDB is required for durable data. The no-URI development fallback is ephemeral and is not persistent.

1. From the repository root, make a local backend environment file:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   notepad backend\.env
   ```

2. Set `MONGODB_URI` to your local MongoDB URI (`mongodb://127.0.0.1:27017/securenexus`) or a private Atlas connection string. Replace `JWT_SECRET` with a random secret (generate one with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). Never commit `backend/.env` or paste secrets into chat.
   Also set `APP_BASE_URL=http://localhost:3000`, `TRUSTED_CORS_ORIGINS=http://localhost:3000`, and optionally `ROOM_SCAN_TOKEN_TTL_MINUTES=20`. `APP_BASE_URL` is the canonical origin used in candidate invitation and room-scan links; do not use a wildcard CORS origin with credentials.
3. Install/start the backend in terminal 1:

   ```powershell
   npm --prefix backend ci
   npm --prefix backend run dev
   ```

4. Install/start the Next.js app in terminal 2:

   ```powershell
   npm ci --legacy-peer-deps
   npm run dev
   ```

   `--legacy-peer-deps` works around the repository's existing Zoom Meeting SDK React 18 peer declaration; this project itself uses React 19.
5. Open <http://localhost:3000>. Confirm persistent storage at <http://localhost:5000/api/health>: `db.mode` must be `mongodb`. `mongodb-memory` is temporary; `file` means MongoDB did not connect.

Development seeds demo users: `recruiter@securenexus.dev` / `recruiter123` and `candidate@securenexus.dev` / `candidate123`. Do not use these demo credentials on a public site.

## Create an invitation and join

1. Sign in with any active account and open `/recruiter/interviews` from the dashboard's **Create Interview** link.
2. Enter the interview title and invited candidate email, select **Live interview**, then **Create Interview Session**.
3. Any signed-in account can create an interview; the account that creates it owns the interview record. Only recruiters, interviewers, and admins can start or end the live session. Copy the generated candidate join link and send it yourself by email or chat; the app does not send emails.
4. The candidate opens the link in Chrome, signs in or creates a candidate account with the invited email, and selects **Join interview lobby**.
5. On the recruiter **View Session** page, select **Start interview**, then **Open live interview room**. The candidate lobby routes into the active interview. Allow camera/microphone permissions and start the camera as needed.

A `localhost` invitation only works on the same computer. A public link becomes available only after deployment; the recruiter page will generate it using the hosted frontend origin.

## Consented mobile room scan

From a recruiter interview session, select **Create room-scan link** and open the generated one-time URL on the candidate's phone. The link is bound to that interview's existing session, expires after `ROOM_SCAN_TOKEN_TTL_MINUTES` (20 by default), and stores only a SHA-256 token hash. The candidate must explicitly consent before recording a short room video; video files are stored in the backend's private `private-room-scans/` directory and are streamed only through an authenticated recruiter review endpoint. The scan status is copied onto the existing interview session so it remains connected to the invitation and active interview.

The optional phone-away checkbox is a candidate self-report, not proof of physical placement. Browser APIs and BLE scans cannot detect every nearby radio/device and cannot establish an exact two-metre distance. Do not use this review aid as an automatic hiring decision.

For phone camera access, use HTTPS. `localhost` is allowed for same-device development, but a phone needs a temporary HTTPS tunnel such as `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`. Set `APP_BASE_URL` and `TRUSTED_CORS_ORIGINS` to the exact HTTPS frontend origin, and include the backend origin in the tunnel/deployment CORS configuration. In production, use private object storage (or a protected volume), TLS, a retention/deletion policy, and secret-manager values for `JWT_SECRET`, database credentials, `APP_BASE_URL`, and CORS origins. If Zoom is enabled, add the deployed frontend origin to the Zoom Meeting SDK app's allowed domains and update the existing Zoom SDK environment values; never commit SDK secrets.

## Interview activity and nearby-device review

During an active call, browser visibility changes are timestamped as tab-switch events. Three or more tab-switch events within one minute create one server-side `SUSPICIOUS_ACTIVITY` warning for that minute; this is a human-review signal, not proof of intent. An extra socket participant beyond the expected room size is also flagged. The host sees these warnings in the live integrity/security panels.

Nearby-device review is an optional Windows-only companion scan. The candidate downloads and runs the PowerShell companion, pairs it with the interview using its one-time code, and allows the browser's local-network permission if requested. It listens for Bluetooth LE advertising signals and reports only a bounded count; it does not use Wi-Fi or send names/addresses. Many phones and laptops do not advertise discoverably, so scans can miss them. RSSI is not a reliable two-meter measurement, device identity, or proof of absence. A reported signal prompts human review for both participants; it is not a misconduct conclusion.

## Optional multi-face count

The candidate's live camera has an **off-by-default opt-in**. While the interview session is active and the candidate's camera is on, they can enable local face counting. MediaPipe runs against the local preview in the browser and reports zero, one, or multiple visible faces. The detector sends no video frames, screenshots, face identity, landmarks, or gaze data to the backend. If two or more faces appear for consecutive samples, the app saves one `MULTIPLE_FACE_DETECTED` event for that detection episode with only `faceCount`; the backend adds the normal interview/user association and timestamp. The recruiter sees the warning event and incident count in the live security panels.

The live meeting video is still sent peer-to-peer to the other interview participant as part of the call. The face-count detector does not send an additional copy to SecureNexus. Detection may miss faces or produce false counts; it is an optional review signal, not proof of identity, misconduct, or a standalone hiring decision. It does not detect eye contact. The candidate can turn it off at any time; the task continues if the detector is unavailable.

## Security ML models

Security analysis combines a Random Forest of 51 bootstrap-sampled CART trees with a dependency-free 1D temporal-convolution classifier using ReLU, global pooling, and learned class centroids. The two risk probabilities are blended 60/40. Its inputs include browser activity and opt-in BLE signal counts. Face-count incidents stay outside the model and are not used for identity, gaze, or candidate scoring. Without `ML_TRAINING_DATA`, the service uses deterministic synthetic bootstrap data for demo/code-path validation only; it is not a validated hiring model.

Each analysis response also includes a deterministic 80/20 holdout snapshot with accuracy, macro precision, macro recall, macro F1, per-class metrics, and a confusion matrix. The API explicitly reports that fairness testing is not run because the product does not collect protected-attribute data; a real deployment must run an approved offline fairness audit using consented, de-identified evaluation data. These metrics are suitable for a final-year-project demonstration, not automatic hiring decisions.

## MongoDB Atlas and public deployment

The repository is prepared for **MongoDB Atlas + Render (backend) + Vercel (frontend)**. No service has been deployed and no public URL exists until you complete the following with your own accounts:

1. Create a MongoDB Atlas cluster and database user. Restrict Network Access to the backend host's outbound addresses where available. Copy the database connection URI and keep the username/password private.
2. Push this repository to a Git provider and create a Render Web Service from `render.yaml`. It uses `backend/`, `npm ci --legacy-peer-deps`, `npm start`, and `/api/health`; it must be a persistent Node service for Socket.IO. In Render's private environment settings, set:
   - `MONGODB_URI`: Atlas connection string
   - `FRONTEND_URL`: the eventual Vercel origin, e.g. `https://your-project.vercel.app`
   - `INITIAL_RECRUITER_NAME`, `INITIAL_RECRUITER_EMAIL`, `INITIAL_RECRUITER_PASSWORD`: a real account for the first recruiter (password at least 12 characters). These are only used to create that recruiter if the email is not already present; after the recruiter exists, they can be cleared. Public signup always creates candidates; it cannot grant recruiter/admin roles.
   - `JWT_SECRET` is generated by the Render blueprint; ensure it remains at least 32 random characters.
3. Deploy the backend and wait for `https://<render-service>.onrender.com/api/health` to report `db.mode: "mongodb"`. Production refuses to start or write to file storage if MongoDB is missing/unreachable. It does not seed public demo users. If importing an old development database, remove its demo accounts before opening the public site.
4. Import the same repository into Vercel with the Next.js root at `.`. Use install command `npm ci --legacy-peer-deps` and build command `npm run build`. Set:
   - `NEXT_PUBLIC_API_URL=https://<render-service>.onrender.com/api`
   - `NEXT_PUBLIC_SOCKET_URL=https://<render-service>.onrender.com`

   Use `npm ci --legacy-peer-deps` as the Vercel install command to accommodate the existing Zoom SDK peer declaration.
5. Deploy the frontend. Update Render's `FRONTEND_URL` to the exact Vercel origin (including any custom domain) and redeploy/restart the backend.
6. Open the resulting `https://<your-project>.vercel.app` URL in Chrome, sign in as the recruiter account, create the interview, and send its generated candidate link. HTTPS is necessary for browser camera/microphone access.

For restrictive networks, configure a TURN relay using backend-only `TURN_URLS`, `TURN_USERNAME`, and `TURN_CREDENTIAL`; do not put TURN credentials in `NEXT_PUBLIC_*` variables. The optional Windows BLE companion is not guaranteed to detect non-advertising radios or prove an exact physical distance.

## Checks

- Frontend: `npm run lint`, `npx tsc --noEmit`, and `npm run build`
- Backend: `npm --prefix backend test`
