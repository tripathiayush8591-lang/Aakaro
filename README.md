# Aakaro

**Give your idea an identity.**

Aakaro turns a rough product idea into a coherent, editable brand system through a guided AI workflow. The founder confirms the important decisions; AI supplies structured options, trade-offs, and review help.

## Core differentiators

- Structured guided workflow from idea to export, rather than disconnected generators.
- The Graveyard keeps the three evaluated names that were rejected when two are shortlisted.
- Human chooses; AI assists with candidates, directions, kits, and explanations.
- Confirmed Brand Rules become explicit identity constraints.
- Brand Spellcheck traces issues to the exact confirmed rule and keeps original pasted content separate from working content.

## Core journey

Idea → three clarification questions → strategy → five names and evaluation → choose two → The Graveyard → two brand directions → lock one → editable Brand Kit → confirm Brand Rules → Brand Spellcheck → apply fixes → re-check → Markdown or browser Print/Save as PDF → completion.

The app stores one active project in browser `localStorage`, scoped to the signed-in Firebase UID. This is local recovery, not cloud backup.

## Stack

- Frontend: React, Vite, TypeScript, Firebase Web Auth
- Backend: FastAPI, Pydantic, `uv`
- AI: official `google-genai` Python SDK with structured Pydantic output, bounded deadlines, and one schema-repair attempt
- Persistence: browser-local project storage

## Run locally

Prerequisites: Node.js 24, Python 3.11+, and `uv`.

From the repository root, create the ignored environment files once:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

For the repeatable local demo, set the development flags shown in the examples:

- Backend `DEV_AUTH_ENABLED=true`
- Backend `MOCK_PROVIDER_ENABLED=true`
- Frontend `VITE_DEV_AUTH_BYPASS=1`

These flags are development-only. The UI labels mock mode `Dev preview · mock AI`; it is not presented as live Gemini output.

Start the backend in one terminal:

```powershell
cd C:\Users\yash2\Documents\Aakaro\backend
uv sync --frozen
uv run uvicorn app.main:create_app --factory --reload --host 127.0.0.1 --port 8000
```

Start the frontend in another:

```powershell
cd C:\Users\yash2\Documents\Aakaro\frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Keep the `localhost` origin consistent with `CORS_ORIGINS`; `127.0.0.1:5173` is a different origin.

## Environment variable names

Backend:

`GEMINI_API_KEY`, `GEMINI_MODEL`, `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, `CORS_ORIGINS`, `PROVIDER_TIMEOUT_SECONDS`, `USER_REQUEST_LIMIT`, `USER_WINDOW_SECONDS`, `CONNECTION_TEST_ENABLED`, `DEV_AUTH_ENABLED`, `MOCK_PROVIDER_ENABLED`

Frontend:

`VITE_API_BASE_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_DEV_AUTH_BYPASS`

## Firebase Authentication Setup

### Environment Variables

**Frontend (`frontend/.env.local` - local ignored only):**
- `VITE_API_BASE_URL`: Backend base address (e.g. `http://localhost:8000`)
- `VITE_FIREBASE_API_KEY`: Public Firebase Web API Key
- `VITE_FIREBASE_AUTH_DOMAIN`: Firebase Auth Domain (`<project-id>.firebaseapp.com`)
- `VITE_FIREBASE_PROJECT_ID`: Firebase Project ID
- `VITE_FIREBASE_APP_ID`: Firebase Web App ID
- `VITE_DEV_AUTH_BYPASS`: Optional dev-only bypass flag (leave empty/omitted for real auth)

**Backend (`backend/.env` - local ignored only):**
- `FIREBASE_PROJECT_ID`: Firebase Project ID
- `GOOGLE_APPLICATION_CREDENTIALS`: Path to service account JSON file (or host Application Default Credentials)
- `DEV_AUTH_ENABLED`: Set to `false` for real Firebase Admin verification (defaults to `false`)
- `CORS_ORIGINS`: Allowed origins array (e.g. `["http://localhost:5173"]`)

Never commit `.env`, `.env.local`, Firebase service-account JSON, or API keys. Gemini keys and Firebase Admin credentials must remain server-side; Firebase web configuration is public browser configuration.

### Firebase Console Setup
1. **Google Provider:** In Firebase Console > Authentication > Sign-in method, enable the **Google** provider.
2. **Anonymous Provider:** In the same Sign-in method list, also enable **Anonymous**. This powers the production-safe "Continue as guest" option: the guest receives a real anonymous Firebase UID and ID token verified by the backend like any other sign-in.
3. **Authorized Domains:** In Authentication > Settings > Authorized domains, confirm `localhost` is listed.
4. **Web App:** Register a Web App under Project Settings to obtain the 4 public `VITE_FIREBASE_*` values.
5. **Service Account Credentials:** Under Project Settings > Service accounts, generate a new private key and reference the path via `GOOGLE_APPLICATION_CREDENTIALS` (or use host ADC).

### Running in Real Auth Mode (Default)
1. **Frontend:** Configure the 4 `VITE_FIREBASE_*` values in `frontend/.env.local`. Keep `VITE_DEV_AUTH_BYPASS` unset or empty.
2. **Backend:** In `backend/.env`, set `FIREBASE_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS`, and `DEV_AUTH_ENABLED=false`.
3. Flow: Google Sign-In popup → Firebase client ID token → `Authorization: Bearer <token>` → FastAPI `require_identity` → Firebase Admin `verify_id_token()` → verified UID → user-scoped rate limiting and project persistence.

### Running in Optional Dev Bypass Mode
1. **Frontend:** Set `VITE_DEV_AUTH_BYPASS=1` in `frontend/.env.local` while Firebase values are unconfigured. The frontend dev bypass is only available in development (`import.meta.env.DEV`) and is impossible in production builds.
2. **Backend:** In `backend/.env`, set `DEV_AUTH_ENABLED=true`. A built-in guard prohibits `DEV_AUTH_ENABLED` when `ENVIRONMENT=production`.

## Real Gemini and AI Selection

Authentication and AI provider selection are completely independent:
- `MOCK_PROVIDER_ENABLED=true`: Deterministic offline stand-in (ideal for testing and development without consuming API quota).
- `MOCK_PROVIDER_ENABLED=false`: Live Gemini 2.5 Flash calls via `GEMINI_API_KEY`.
Both modes work with real Firebase authentication.


## Verification

```powershell
cd C:\Users\yash2\Documents\Aakaro\backend
uv run pytest -q

cd C:\Users\yash2\Documents\Aakaro\frontend
npm run typecheck
npm test
npm run build

cd C:\Users\yash2\Documents\Aakaro
git diff --check
```

`GET /health` is a process-liveness check only. Protected AI routes require an identity; CORS accepts exact configured origins only. The in-memory request limiter is intended for one worker/instance and is not shared across replicas.

## Deployment preparation

The frontend is a Vite static site: build `frontend` with `npm ci` and `npm run build`, then publish `frontend/dist` with the public Firebase values and an HTTPS `VITE_API_BASE_URL` supplied at build time.

The backend includes a host-neutral [backend/Dockerfile](backend/Dockerfile) for an ASGI container. Configure secrets in the host secret manager, use one worker/instance, set `CORS_ORIGINS` to the exact HTTPS frontend origin, and verify `/health`, a CORS preflight, Google sign-in, and one protected Gemini request.

This workspace currently has no configured Git remote or deployment host, and no live deployment is claimed. See [DEMO.md](DEMO.md) for the repeatable presentation sequence.

## Known limitations

- Without Gemini and Firebase credentials, the local demo uses the explicit deterministic mock/dev path.
- Project persistence is browser-local and limited to the current browser/user context; it is not encrypted or server-backed.
- Names are suggestions only: Aakaro does not perform availability, trademark, cultural-clearance, or competitor research.
- Brand previews are fixed text-and-shape concepts, not final logos or deployed websites.
- Print/Save as PDF uses the browser print flow; there is no PDF backend.
- No social generator, collaboration, analytics, payments, domain checks, or other post-feature-freeze work is included.
