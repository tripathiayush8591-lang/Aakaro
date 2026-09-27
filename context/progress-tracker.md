# Aakaro: Progress Tracker

## Current phase
Phase 1 foundation implemented and locally verified with mocked auth/provider tests. Real account-backed acceptance remains blocked by missing Firebase/Gemini configuration; no deployment has been performed. Later phases remain unimplemented.

## Current goal
Create the React/FastAPI skeleton, validate one real Gemini request, configure Firebase Google sign-in, and deploy an initial frontend/backend connection.

## Completed decisions (not implemented features)
- [x] Product name: Aakaro.
- [x] Tagline: Give your idea an identity.
- [x] MVP: guided idea-to-brand kit with two directions and explained consistency review.
- [x] Stack: React/Vite/TypeScript + FastAPI/Pydantic + Firebase Auth + Gemini.
- [x] Persistence: localStorage per user; no cloud project database.
- [x] UI is intentionally flexible and can change repeatedly.
- [x] Export: Markdown and browser print/PDF.
- [x] Context pack authored and revised for The Graveyard, Brand Spellcheck, and optional Say My Name.

## Implementation checklist
- [x] Scaffold frontend/backend and placeholder environment files.
- [ ] Real provider call with schema validation.
- [ ] Skeleton deployment and cross-origin connectivity.
- [ ] Google sign-in and protected backend verification.
- [x] API/Python/TypeScript contracts aligned for the Phase 1 connection test.
- [ ] Idea and three clarification questions.
- [ ] Editable strategy and confirmation.
- [ ] Five naming candidates, separate evaluation, validated 2/3 partition.
- [ ] Two directions and selection with expandable Graveyard.
- [ ] Complete brand kit and text editing.
- [ ] Landing preview and text wordmark.
- [ ] Editable brand rules and user confirmation.
- [ ] Kit review with specific reasons.
- [ ] Pasted-content Spellcheck: deterministic + AI checks, rule-linked issues, separate rewrite.
- [ ] Preserve original content and invalidate stale rule/content reviews.
- [ ] Individual fix application, revision check, re-review.
- [ ] Refresh recovery, logout separation, stale response protection.
- [ ] Markdown download and print view.
- [ ] Loading, retry, quota, invalid output, and error states.
- [ ] Typecheck/build and targeted backend/state tests.
- [ ] Real deployed end-to-end smoke test.
- [ ] README, accessible repo, video, and per-person submission evidence.

## Optional stretch — not a core completion gate
- [ ] Say My Name: maximum two locales, preliminary language screen.
- [ ] Matching browser voice playback/stop with unavailable-voice handling.
Only start after the core deployed journey is verified and before feature freeze; otherwise defer.

## In progress
Phase 1 live Firebase/Gemini verification awaits account configuration. Existing unchecked full-MVP items below remain future scope.

## Next three actions
1. Supply Firebase web/Admin configuration and a Gemini key/model in ignored environment files.
2. Verify real Google sign-in → protected Gemini response → sign-out, then deploy to the selected hosts and repeat over HTTPS.
3. After Phase 1 acceptance and a Phase 2 request, implement idea intake and the three-question clarification slice. Do not start later phases automatically.

## Setup items to resolve during implementation
- Working Gemini API key, selected model, and available quota.
- Firebase project, enabled Google provider, authorized domains, Admin credentials.
- Frontend/backend hosts, origins, timeouts, and environment settings.
- Official hackathon deadline, submission form, and exact sponsor account tags.
- Latest UI reference, if supplied; otherwise use provisional UI defaults without blocking.
Never write secret values into this file.

## Verification evidence
See the appended Phase 1 implementation record below. Historical specification decisions and future checklist items are preserved.

## Known limitations by design
Single active project per user/browser; no cross-device sync. Names are not trademark-cleared. No live competitor research. Template previews only. AI review is advisory.

## Decision log
- 2026-09-27: Adopted 7–8 hour MVP scope; FastAPI and Firebase Auth selected by user.
- 2026-09-27: Aakaro name locked; UI appearance remains provisional.
- 2026-09-27: Added Graveyard and Brand Spellcheck as core; Say My Name as stretch. Removed social preview to protect timebox. Same Gemini provider; no additional paid API. All new features remain unimplemented/unverified.

## Handoff template
- Current milestone:
- Files changed:
- Verified:
- Not yet verified:
- Blocker / setup needed:
- Next exact action:
- Approximate time remaining:

## Phase 1 implementation record — 2026-09-27

### Implemented
- React/Vite/strict TypeScript frontend and FastAPI/Pydantic backend; pinned manifests, npm/uv lockfiles, ignored credential patterns, placeholder env files, README, and backend Dockerfile.
- Reference-inspired responsive Google-only authentication page. Separate signed-in temporary diagnostic view, session initialization state, name/email, sign-out, actionable popup errors, independent health/AI status, input preservation and manual retry.
- Central frontend API client obtains Firebase ID tokens, validates response shape, and checks session identity. Unmount/sign-out aborts and discards pending responses and clears user-specific memory. Firebase SDK manages auth persistence; project persistence is out of scope.
- `/health` and protected `/api/connection-test`; trimmed 1–1,000-character input; verified Admin claims with revocation checking; request IDs, safe normalized errors and explicit CORS.
- Official `google-genai` async structured output validated by Pydantic, configured model, total 25-second default deadline, disabled SDK retries, at most one schema repair, no live fixtures. Five attempts per user/minute and one concurrent request by default; process-local limits documented.
- `CONNECTION_TEST_ENABLED=false` disables the temporary route. No later-phase features implemented.

### Actually verified
- `uv run pytest -q`: **21 passed**, using mocked Firebase/provider dependencies. Covers missing/invalid/expired auth, validation, extra-field rejection, trimming, IDs, limits/concurrency, CORS, safe unexpected errors, configuration failures, provider quota/configuration/unavailability/timeout, and one bounded schema repair.
- `npm test`: **8 passed**, using mocked auth/transport. Covers initialization, retry/input preservation, completed-result clearing, stale-response rejection across sessions, ID-token attachment, public health validation, and normalized provider errors.
- `npm run typecheck` and `npm run build`: passed. Python Ruff checks passed after formatting/import cleanup. npm audit reported zero vulnerabilities at installation.
- Real local Uvicorn HTTP checks: `/health` **200**, missing-token POST **401**, allowed-origin CORS preflight **200**. Health did not require provider/auth credentials.
- Real browser via agent-browser: auth page renders, Google-only action present, no diagnostic fields on signed-out page, no browser errors/Vite overlay. Desktop and 390×844 mobile checked; no mobile horizontal overflow; missing-config sign-in shows a helpful message. A mobile text-spacing issue found during inspection was fixed.
- One non-failing Starlette TestClient warning recommends future migration from httpx to httpx2; test behavior passed with the pinned dependencies.

### Not verified / blockers
- **No live Google login, Firebase Admin token verification, or Gemini generation**: no Firebase/Gemini environment configuration was present. Mocked success is not live integration evidence.
- Supply frontend `VITE_API_BASE_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`; backend `GEMINI_API_KEY`, `GEMINI_MODEL`, `FIREBASE_PROJECT_ID`, `CORS_ORIGINS`, and `GOOGLE_APPLICATION_CREDENTIALS` or host ADC. Follow README for Google provider/authorized-domain setup. Never put secret values in this tracker.
- No Git metadata/remote or host configuration existed. No deployment was attempted. Docker CLI exists but Docker engine is not running, so the prepared image has not been built/tested.
- HTTPS connectivity, deployed CORS, Firebase production domain, host credentials/timeouts, and real protected AI request remain required deployment checks.

### Handoff
- Phase 1 implementation is complete; **Phase 1 acceptance is not fully met until the real authenticated flow is verified**.
- Local startup/check commands and exact account/deployment steps are in README. Development servers were started at ports 5173 and 8000 for local verification.
- Next Phase 2 action (only after requested): define the clarification request/response contract and build idea intake → exactly three clarifying questions as a vertical slice, replacing the temporary diagnostic entry point.
