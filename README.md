# Aakaro

**Give your idea an identity.**

Phase 1 foundation only: Google sign-in → authenticated FastAPI request → schema-validated Gemini response → sign-out. The signed-in connection test is a temporary diagnostic, not the branding workflow. No project persistence, database, branding pipeline, or other sign-in providers are implemented.

## Run locally (PowerShell)

Prerequisites: Node.js 24 (tested with 24.14.0), Python 3.11+ (tested with 3.13.5), and uv (tested with 0.11.21). Dependencies are pinned in the manifests and lockfiles.

From the repository root, first-time setup:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Edit those files with your own configuration. Do not repeat the copy commands over configured files. Start two terminals:

```powershell
cd C:\Users\yash2\Documents\Aakaro\backend
uv sync --frozen
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

```powershell
cd C:\Users\yash2\Documents\Aakaro\frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. The API is **http://localhost:8000**. Use `localhost` consistently: `http://127.0.0.1:5173` is a different CORS origin. Restart the backend after changing configuration; restart/rebuild Vite after changing `VITE_*` values.

The app can render without Firebase configuration; clicking sign-in explains that setup is needed. `/health` is intentionally a process-liveness check and remains healthy without AI/auth configuration. Protected operations fail closed with safe configuration errors. Health does not claim that Firebase or Gemini works.

## Firebase setup

1. Create/select your Firebase project. Register a **Web app** in Project settings.
2. In Authentication → Sign-in method, enable **Google only** and choose a support email. Do not enable email/password or other providers.
3. In Authentication → Settings → Authorized domains, add `localhost` and your eventual production frontend hostname. Add `127.0.0.1` only if you plan to use that address. New projects may not include localhost automatically.
4. Copy the web app's public `apiKey`, `authDomain`, `projectId`, and `appId` to `frontend/.env.local` as `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`.
5. Set backend `FIREBASE_PROJECT_ID` to the same project ID. For local Admin access, create/download a service-account credential from Project settings → Service accounts and store it **outside the repository**. Set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path. On a Google-managed host, prefer an attached service identity/Application Default Credentials and omit the file setting. The identity needs permission to read Firebase Auth users because verification also checks revocation/disabled users.
6. Allow browser pop-ups, click Continue with Google, and choose your account. Firebase manages session persistence and ID-token refresh. A refresh restores auth, but diagnostic input/output intentionally is not persisted.

Never put Admin private keys or Gemini keys in `VITE_*` values. Firebase public web configuration is expected in the browser; Admin credentials are not. The backend derives UID exclusively from verified claims for its configured project.

**Temporary development settings (auth deferred).** While Firebase sign-in is deferred, two explicit opt-in flags keep the core flow runnable locally. Both default to `false`, must never be enabled in production, and are to be removed when authentication resumes:
- Backend `DEV_AUTH_ENABLED=true` skips Firebase token verification and uses the fixed local identity `dev-local` instead (see `backend/app/services/auth.py`).
- Backend `MOCK_PROVIDER_ENABLED=true` swaps Gemini for a deterministic local stand-in (`backend/app/services/mock_ai.py`); the UI labels this mode "Dev preview · mock AI".
- Frontend `VITE_DEV_AUTH_BYPASS=1` opens the guided workspace without sign-in, and only in a development build when Firebase is unconfigured. It can never appear in a production build.
There is no other auth bypass or emulator configuration in application code.

## Gemini and backend settings

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-only Gemini Developer API key with available quota |
| `GEMINI_MODEL` | Exact model ID available to your account that supports structured output; no hardcoded default |
| `FIREBASE_PROJECT_ID` | Project against which Admin verifies ID tokens |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional absolute service-account file path; otherwise use ADC |
| `CORS_ORIGINS` | JSON array of exact frontend origins, e.g. `["http://localhost:5173"]`; no wildcard or trailing slash |
| `PROVIDER_TIMEOUT_SECONDS` | Total Gemini deadline across both attempts; default 25, range 1–45 |
| `USER_REQUEST_LIMIT` | Attempts per verified user per window; default 5 |
| `USER_WINDOW_SECONDS` | Rate-limit window; default 60 seconds |
| `CONNECTION_TEST_ENABLED` | Default true; false disables the temporary endpoint |
| `DEV_AUTH_ENABLED` | TEMPORARY, default false; development-only token-verification bypass while auth is deferred. Never set in production |
| `MOCK_PROVIDER_ENABLED` | TEMPORARY, default false; development-only deterministic provider stand-in. Never set in production |

Set frontend `VITE_API_BASE_URL=http://localhost:8000` locally. The frontend timeout is 55 seconds. Health and AI connectivity have separate states; only an actual successful AI response marks AI connected.

Choose the model in [Google AI Studio](https://aistudio.google.com/) or the [model documentation](https://ai.google.dev/gemini-api/docs/models). Do not assume a coding-assistant subscription supplies API quota. This repository deliberately does not guess a latest model. The installed official Python SDK is `google-genai==2.25.0`; it uses asynchronous `client.aio.models.generate_content`, structured `response_schema`, and subsequent Pydantic validation. System instructions are separate from JSON-encoded user input. SDK retries are disabled; one retry is allowed only for invalid output, within the same total deadline. Quota, credential, and timeout failures are not automatically retried.

## API contract

`GET /health` returns `{ "requestId": "...", "data": { "status": "ok" } }` without calling Gemini.

`POST /api/connection-test` requires `Authorization: Bearer <Firebase ID token>`:

```json
{ "requestId": "client-generated-uuid", "idea": "An app helping students find hackathon teammates." }
```

The idea is trimmed and must contain 1–1,000 characters. Extra request fields (including user IDs) are rejected. The success envelope contains `summary`, `possibleAudience`, and `clarifyingQuestion` in `data`; each is a nonempty string with a maximum of 1,200 characters.

`POST /api/idea/clarify` (same auth requirement) takes `{requestId, idea}` and returns exactly three questions: `data.questions[]` with `id` (`q1`–`q3`, canonicalized server-side), `question` (≤300 chars), and `reason` (≤300 chars).

`POST /api/strategy/generate` takes `{requestId, idea, clarifications}` with exactly three `{question, answer}` pairs (answers ≤1,200 chars) and returns a structured brief in `data`: `oneLiner`, `audience {primary, description}`, `problem`, `promise`, `differentiation`, `personality` (exactly 3), `positioning`, and `namingTerritories` (2–4).

`POST /api/naming/candidates` takes `{requestId, strategy}` (the confirmed brief) and returns exactly five naming candidates in `data.candidates[]` with `id` (`n1`–`n5`, canonicalized server-side), `name` (≤40 chars, five distinct names), `rationale` (≤300), `territory` (≤80), and optional `linguisticNote` (≤200). Duplicate ids or case-insensitively duplicate names are repaired once, then rejected.

`POST /api/naming/evaluate` takes `{requestId, strategy, candidates}` (the five actually generated candidates) and returns `data.evaluations[]` — exactly five entries referencing the submitted ids with 1–5 integer `scores` (`distinctiveness`, `strategicFit`, `memorability`, `extensibility`), one to three `strengths` and `risks` (each ≤120 chars), and a `verdict` (≤300). Evaluations must cover exactly the submitted candidate ids; coverage failures are repaired once, then rejected. The client shortlists exactly two; the remaining three are recorded in The Graveyard with their stored evaluation.

`POST /api/directions/generate` takes `{requestId, strategy, shortlistedCandidates, evaluations}`: the confirmed brief, exactly two distinct shortlisted candidates and exactly their two evaluations. Returns `data.directions[]` with canonical `direction1`/`direction2` mapped to shortlist order, `candidateId`, `conceptName`, `conceptStatement`, `personality`, `colors`, `typography`, `logoApproach`, `imagery`, and `voice`. Four colors must be six-digit HEX values. Invalid structure/mapping is repaired at most once. Uses the existing identity dependency, limiter, timeout and deterministic mock switch. Graveyard candidates are not sent.

`POST /api/brand-kit/generate` takes `{requestId, strategy, selectedCandidate, selectedDirection}` from the confirmed upstream decisions. It returns an editable `BrandKit` with identity, the direction's four HEX colors, typography, text-only wordmark guidance, imagery, voice preferences, and 6–10 structured `BrandRule` objects. The server enforces the selected name, palette continuity, and canonical `rule1`…`ruleN` IDs. The browser stores draft and confirmed kits in the canonical project, updates a neutral live preview immediately, and advances to `spellcheck` only after ClayModal confirmation. Spellcheck itself is intentionally not implemented in Phase 5.

```json
{ "requestId": "...", "error": { "code": "PROVIDER_TIMEOUT", "message": "AI took too long. Please try again.", "retryable": true } }
```

Auth failures use 401; input validation 422; per-user limits/quota 429; provider failures 502; unavailable configuration/auth/provider setup 503; timeout 504. Unexpected failures use a generic 500 without exception details. `X-Request-ID` is accepted if it is 1–64 letters/digits/underscores/hyphens, otherwise generated. The frontend sends the same ID in the header and body, so auth/validation failures can also be correlated. A valid route body ID becomes the response ID. IDs are correlation values, not idempotency keys.

There is one concurrent AI request per user. Limits are **in memory per process**, expire after the configured window, reset on restart, and do not coordinate across replicas. Deploy one worker/instance for this foundation or add shared limiting before scaling. Failed AI attempts count toward the user limit. Client abort/sign-out discards the response but cannot guarantee an already dispatched provider call is cancelled.

## Verification

```powershell
cd C:\Users\yash2\Documents\Aakaro\backend
uv run pytest -q
```

```powershell
cd C:\Users\yash2\Documents\Aakaro\frontend
npm run typecheck
npm run build
npm test
```

Backend tests mock Firebase Admin/provider behavior: missing/invalid/expired auth, validation, trimmed inputs, response IDs, CORS, errors, quota, timeout, schema repair, and limits. Frontend tests mock Firebase/transport: initializing auth, failure/retry, input preservation, sign-out cleanup, stale-session responses, and token attachment. Test fixtures never enter the application runtime.

Actually verified locally: production build; backend and frontend automated tests; browser auth screen at desktop/mobile sizes; local health 200, missing-token 401, and CORS preflight. **Real Google sign-in, real token verification, real Gemini output, and deployed HTTPS integration have not been verified**, because account configuration is absent. See `context/progress-tracker.md` for exact counts and evidence.

After credentials are supplied, sign in, submit an idea, inspect the three returned fields, sign out, and verify the result disappears. Refresh once while signed in to confirm SDK auth persistence. This is the outstanding live acceptance check; passing mocked tests is not a substitute.

## Deployment preparation

No existing host/repository remote was present and no deployment has been performed. A host-neutral backend Dockerfile is included; its image build is not yet verified. Use one existing preferred static host plus one container/Python backend host rather than adding a database or framework.

1. Frontend: root `frontend`, install `npm ci`, build `npm run build`, publish `dist`. Supply the four public Firebase variables and HTTPS `VITE_API_BASE_URL` **at build time**. This is a single-page app without additional routes.
2. Backend: build the `backend/Dockerfile` with context `backend` (`docker build -t aakaro-api ./backend`). It runs as a non-root user, listens on the host's `PORT` (default 8000), and uses one worker. Alternatively use `uv sync --frozen --no-dev` and `uv run uvicorn app.main:app --host 0.0.0.0 --port <host-port> --workers 1`.
3. Configure backend secrets in the host's secret manager. Mount the Admin credential file readable by the container user, or attach an appropriate ADC service identity. Never bake credentials into the image. Set `CORS_ORIGINS=["https://your-frontend-host"]`.
4. Add the frontend hostname to Firebase authorized domains. Use HTTPS for both applications and configure an upstream request timeout of at least **60 seconds** to accommodate bounded Firebase verification plus the AI deadline.
5. Check `/health`, the real browser CORS preflight, Google sign-in, and an actual protected Gemini request. Then sign out and confirm response cleanup. Inspect only safe request IDs on failures.

The temporary route lives in `backend/app/api/connection.py`; the UI in `frontend/src/components/ConnectionTest.tsx`. Disable it with `CONNECTION_TEST_ENABLED=false`, then replace/remove the component when Phase 2 provides the real flow.

## Official references checked during implementation

- [Firebase Google sign-in](https://firebase.google.com/docs/auth/web/google-signin)
- [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)
- [Verify Firebase ID tokens](https://firebase.google.com/docs/auth/admin/verify-id-tokens)
- [Official Google Gen AI Python SDK](https://github.com/googleapis/python-genai)

Presentation follows the supplied split-card reference with a local vector landscape, white surface, rounded edges, and Google-only action. Theme tokens live in `frontend/src/styles/theme.css`. Existing full-MVP context is retained as future scope; only Phase 1 is implemented.
