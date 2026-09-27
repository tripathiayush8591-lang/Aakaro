# Aakaro: Progress Tracker

## Current phase
Phase 3 (Naming Engine + Evaluation + Shortlist + The Graveyard) implemented and verified locally with the development mock provider; the project now reaches the Brand Directions-ready state. Real Gemini and Firebase remain unconfigured; auth is explicitly deferred with opt-in dev flags; no deployment has been performed.

## Current goal
Build the brand-directions stage (Phase 4) on request: two comparable directions from the confirmed shortlist, each referencing one different shortlisted candidate, plus selection that invalidates downstream kit state.

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
- [ ] Google sign-in and protected backend verification. **Deferred by user instruction (2026-09-27); dev-only opt-in flags keep local work unblocked. Do not mark complete until real verification.**
- [x] API/Python/TypeScript contracts aligned for the Phase 1 connection test.
- [x] Idea and three clarification questions.
- [x] Editable strategy and confirmation.
- [x] Five naming candidates, separate evaluation, validated 2/3 partition. (Partition is user-driven per Phase 3 spec: model evaluates all five with scores/strengths/risks/verdict; the user shortlists exactly two; the other three are recorded in The Graveyard.)
- [ ] Two directions and selection with expandable Graveyard. (Shortlist, expandable Graveyard, confirm, and the directions-ready stop point are done; only directions generation + selection remain.)
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
Nothing in flight. Phase 3 (Naming) is complete and verified locally with the mock provider; the project stops at the Brand Directions-ready state per the Phase 3 brief.

## Next three actions
1. On request: Phase 4 — generate exactly two brand directions from the confirmed shortlist (`POST /api/directions`), each referencing one different shortlisted candidate, with selection that invalidates downstream kit state.
2. When Firebase configuration is supplied: re-enable real auth (remove the three temporary dev flags and their code paths, marked `TODO(auth-resume)`), then verify real sign-in → protected Gemini flow → deploy and repeat over HTTPS.
3. Supply Firebase web/Admin configuration and a Gemini key/model in ignored environment files (still missing; never store values in this tracker).

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
- 2026-09-27: Firebase authentication explicitly deferred by user instruction. Temporary opt-in dev flags added (`DEV_AUTH_ENABLED`, `MOCK_PROVIDER_ENABLED`, `VITE_DEV_AUTH_BYPASS`), all default-off, production-unsafe by design, and marked `TODO(auth-resume)`. Final auth architecture unchanged.
- 2026-09-27: Phase 2 UI direction adopted (editorial brand studio; see ui-context.md). Presentation changes did not alter API schemas, prompts, or auth design.
- 2026-09-27: Phase 3 naming decision per the user's Phase 3 brief: the AI evaluates all five candidates (scores/strengths/risks/verdict) but does NOT shortlist — the user shortlists exactly two and the remaining three automatically enter The Graveyard. This supersedes the earlier model-partitioned shortlist/reject contract (disposition field dropped). Evaluation is a separate provider call from candidate generation; candidates are preserved if evaluation fails.

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

## Step 2 implementation record — Idea → Clarification → Strategy → Confirmation (2026-09-27)

### Implemented
- **Backend** (`backend/app/`): `schemas/stages.py` (ClarifyRequest/Result, StrategyGenerateRequest, StrategyBrief with strict bounds, extra="forbid"); `prompts/clarify.py` + `prompts/strategy.py` (grounded, anti-cliché, treat-idea-as-data rules); `services/gemini.py` refactored into a generic bounded structured-call helper (same repair-once/timeout/error mapping; existing `generate` behavior preserved) with new `clarify()` (canonicalizes ids to q1–q3) and `strategy()`; `api/strategy.py` routes `POST /api/idea/clarify` and `POST /api/strategy/generate`; `services/mock_ai.py` development-only deterministic provider behind the identical interface (keyword-persona based, 0.6 s delay).
- **Temporary auth accommodation** (`TODO(auth-resume)`): `DEV_AUTH_ENABLED` (default false) in `services/auth.py::require_identity` returns `dev-local` without token verification; test proves the bypass exists only when the flag is set.
- **Frontend** (`frontend/src/`): canonical `AakaroProject` reducer with `revision`-guarded AI commits (`lib/project.ts`); validated localStorage persistence `aakaro:v1:<uid>:active-project` with corrupt-payload backup and no silent deletion (`lib/storage.ts`); API client additions with strict response validation (`lib/api.ts`); screens `IdeaScreen`, `ClarifyScreen` (one question at a time, 01–02–03 progress, Back preserves answers, "I'm not sure"), `StrategyScreen` (calm generation states, editorial review, inline Edit mode, validation-gated "Lock strategy", NamingReady placeholder with Unlock), `StageRail`, `Workspace` shell; stale-response protection via AbortController + expected-revision match; `VITE_DEV_AUTH_BYPASS` dev-only session branch in `App.tsx` (dev build + Firebase unconfigured only).
- Editorial redesign per ui-context.md (paper/ink/terracotta tokens, serif display, divider-based brief, stage rail). ConnectionTest component retained in repo but no longer the signed-in surface.

### Actually verified
- `uv run pytest -q`: **39 passed** (21 prior + 18 new: clarify/strategy validation, exactly-3 questions, canonical ids, pair passthrough, safe provider failure, dev-auth on/off, mock determinism, service repair/pair serialization). Ruff clean.
- `npm run typecheck` and `npm run build`: passed. `npm test`: **13 passed** (4 api + 4 App + 5 Workspace): empty-idea gate, idea persistence, one-at-a-time questions with answer preservation across Back, generation failure preserving data with retry, refresh restoration, lock → naming stage + storage, inline edit persistence, sign-out/account separation.
- **Real browser (localhost:5173, mock provider)**: full flow — idea entry → exactly 3 questions → answers (Back preserves) → strategy generated → reload restores review → inline edit persisted → Lock → stage `naming`, confirmed + timestamp stored → reload restores "Strategy locked." Screenshots in `gui-test-screenshots/` (idea, clarify Q1, mobile 390px). No horizontal overflow at 1280px or 390px.
- Failure path observed in real browser: request from a non-configured CORS origin (`127.0.0.1:5173`) showed the safe normalized error with idea preserved and a working retry path.
- Endpoints smoke-tested over HTTP with the mock provider: clarify returns 3 canonical questions; strategy returns a schema-valid brief.

### Not verified / limitations
- **Gemini is mocked** (`MOCK_PROVIDER_ENABLED=true`): outputs are deterministic development fixtures, visibly labeled "Dev preview · mock AI" in the UI. Real Gemini behavior, prompt quality, and structured-output compatibility (min/max list constraints in the Gemini schema subset) are unverified until a key/model is configured.
- **Authentication deferred**: no real sign-in, token verification, or session behavior was exercised. Real-user flow still routes through Firebase; production builds cannot enable the bypass (`import.meta.env.DEV` is compile-time).
- Verification-tooling incidents (not app bugs): the in-app browser's input pipeline wedged twice (evidence: hit-tests clean, React wiring intact, raw CDP text injection dead); recovered via fresh tabs and effect-verified retries. One corrupted screenshot artifact was discarded; conclusions rest on DOM snapshots, storage reads, and clean screenshots.
- Refresh during generation retries automatically (interrupted → retryable); quota/timeout UIs are covered by mocked tests only.

### Handoff
- Current milestone: Step 2 complete; Step 3 (Naming) not started, per stop point.
- Files changed: backend — schemas/stages.py, prompts/{__init__,clarify,strategy}.py, services/{gemini,mock_ai,auth}.py, api/strategy.py, core/config.py, main.py, tests/{test_stages.py,test_services.py}, .env.example, .env (flags only); frontend — types/project.ts, lib/{project,storage,api,session}.ts, features/brand/{StageRail,IdeaScreen,ClarifyScreen,StrategyScreen,Workspace}.tsx + Workspace.test.tsx, styles/{theme,app}.css, App.tsx, App.test.tsx, .env.example, .env.local (flag only); docs — README.md, context/*.md.
- Verified: as listed above (39 backend / 13 frontend tests, typecheck, build, real-browser flow with mock provider).
- Not yet verified: real Gemini output, real Firebase auth, deployment.
- Blocker / setup needed: Firebase + Gemini configuration still missing (names in .env.example; never values here).
- Next exact action: on request, build the Naming stage consuming `strategy.confirmed`.
- Approximate time remaining: within the 7–8 hour budget; core slice took roughly 2.5–3 hours including verification.

## UI redesign record — Claymorphism + Bento + Dark/Light (2026-09-27)

### Implemented
- Full presentation-layer redesign per user spec; zero changes to reducer, storage, API client, auth architecture, or backend. `package.json` gained only `@fontsource-variable/manrope` + `@fontsource-variable/dm-sans`.
- `theme.css`: single token system with light + dark themes (`<html data-theme>` set before first paint via inline script; localStorage `aakaro:theme` with system-preference fallback). Clay shadow tokens, accent-tint tokens, radii 10–28px, motion tokens, reduced-motion support.
- `lib/theme.ts` + `components/ThemeToggle.tsx`: persisted animated clay toggle (aria-label, aria-pressed, keyboard accessible).
- `Workspace.tsx`: sticky translucent navbar; horizontal stage-rail strip (`StageRail.tsx` redesign: clay dots, blue current, lime checks). Idea/Clarify bento layouts; Strategy review as a 3-column bento with varied spans and per-tile click-to-edit (pencil affordance, blur/Enter/Escape commit, same dispatch flow); calm clay generation state (stacked layers + honest rotating status emphasis, no fake completion marks); NamingReady hero tile. Obsolete editorial CSS deleted; auth page restyled on the same tokens.

### Actually verified
- `npm run typecheck` ✓, `npm run build` ✓, `npm test`: **13 passed** (edit test updated to per-tile interaction; all functional coverage retained), `uv run pytest -q`: **39 passed** (backend untouched).
- Real browser (dev server, mock provider): NamingReady restore, theme toggle dark→light with localStorage persistence verified across reload and a tab crash; screenshots saved for naming dark/light 1440, idea light/dark 1440, clarify light 1440, strategy review bento 1440, mobile 390 and tablet 768 (all no horizontal overflow). One real defect found and fixed during verification: navbar session text clipped at ≤768px (session block now hidden ≤1024px).
- Remaining visual points seeded via localStorage fixtures during declared environment preparation (screens of idea/clarify/strategy states) because the browser tool's input channel was repeatedly wedged; click-driven flows remain covered by the 13 automated tests plus the earlier live run.

### Known weaknesses / next polish
- Hover-dependent pencil affordance unverifiable in screenshots (visible on hover/focus, always visible on touch devices).
- Dark-mode `color-mix` navbar translucency and backdrop-filter not visually re-verified after the last CSS fix (applied at all widths; low risk).
- Fonts are self-hosted variable fonts; first paint uses system fallback until loaded.

## Phase 3 implementation record — Naming Engine + Evaluation + Shortlist + The Graveyard (2026-09-27)

### Implemented
- **Backend**: `schemas/stages.py` gained `NamingCandidate` (id/name ≤40/rationale ≤300/territory/optional linguisticNote ≤200), `NamingScores` (four 1–5 integers), `NamingEvaluation` (candidateId, scores, 1–3 strengths/risks ≤120, verdict ≤300), request/result models with `model_validator` distinctness checks (five distinct ids AND case-insensitively distinct names). `prompts/naming.py`: two grounded system prompts (breadth across territories; no availability/clearance/research claims; evaluation describes trade-offs, never declares a winner). `services/gemini.py`: `_structured_call` gained an optional post-validation `check` callback flowing into the existing repair-once path; `naming_candidates()` canonicalizes ids to `n1`–`n5`; `naming_evaluation()` verifies the evaluation covers exactly the submitted candidate ids (repair once, then retryable `INVALID_AI_RESPONSE`). New routes `POST /api/naming/candidates` and `POST /api/naming/evaluate` (`api/naming.py`) behind `require_identity` + per-user limiter; mock provider gained deterministic naming fixtures referencing the actual submitted ids.
- **Frontend**: `types/project.ts` — `NamingCandidate`/`NamingScores`/`NamingEvaluation`/`NamingState` (generationStatus idle/generated/ready/confirmed persisted; generating/evaluating are in-flight only) and `AakaroProject.naming`. Reducer: `namingCandidatesSuccess` (revision+stage+confirmed guarded, clears stale selection), `namingEvaluationSuccess` (guarded on five-evaluation id coverage), `toggleShortlist` (ready-only, max two, deselect allowed), `confirmNaming` (requires exactly two; freezes `graveyardIds` as the complement; stage → `directions`). `setIdea`/`editStrategy`/`reviseAnswers`/`unlockStrategy` now reset naming (upstream invalidation). `lib/api.ts`: `generateNamingCandidates`/`evaluateNamingCandidates` with strict response validation (5 candidates, distinct ids/names; 5 evaluations covering exactly the submitted ids, integer 1–5 scores). `lib/storage.ts`: `parseNaming` — missing block defaults to empty (pre-Phase-3 projects keep loading), transient statuses normalize on load, malformed naming rejects the whole payload to the existing corrupt-backup path; confirmed state requires selectedIds∩graveyardIds = full partition of the five. New `NamingScreen.tsx`: user-initiated "Generate 5 names" CTA consuming ONLY `strategy.confirmed` (no confirmed strategy → strategy screen is the recovery path), auto-resume of an interrupted evaluation on reload (candidates preserved, retry evaluation only), shortlist view (five evaluated cards, two-pick cap with disabled+title affordance, aria-pressed selection), expandable The Graveyard (exactly the three non-shortlisted, reasons from the stored evaluation, "will be recorded" → "recorded" copy), confirm dialog, and the `DirectionsReady` stop point (two shortlisted tiles + collapsed Graveyard + "brand directions are next" note + unlock-restarts-naming recovery). Workspace routes `naming`/`directions`; stage rail marks naming done on confirm.
- **Docs**: README API contract gained both naming endpoints; architecture-context API table + implemented feature contracts (user-driven shortlist supersedes model partition); ui-context gained the naming design decision and implemented Graveyard interaction.

### Actually verified
- `uv run pytest -q`: **58 passed** (39 prior + 19 new: naming endpoints auth/validation/provider-failure, canonical id passthrough, duplicate-id/name rejection at 422, mock determinism + id coverage; service-level id canonicalization, duplicate-name repair-then-fail, evaluation id-coverage repair-then-fail).
- `npm run typecheck` ✓, `npm run build` ✓, `npm test`: **19 passed** (13 prior + 6 new: generate→evaluate→ready with confirmed-strategy input assertions, refresh-during-evaluation resume without regeneration, generation failure keeping the locked strategy + evaluation failure keeping candidates with stage-scoped retries, two-pick cap + Graveyard partition + confirm advancing stage/storage, ready-state refresh restore with selection, unlock clearing naming).
- **Real browser (localhost:5173, mock provider, 1440px)**: full Phase 3 journey — idea → 3 questions → strategy → Lock → naming intro ("Strategy locked.", locked-strategy tiles) → Generate 5 names → "Scoring your five names." → shortlist view with five evaluated cards → shortlisted Teamly + Coinedora (third pick disabled, status pill "2 of 2 shortlisted") → Graveyard appeared with exactly TeamSpot/Coinedcraft/TeamLoop + their stored verdicts/risks → Confirm (real window.confirm accepted) → "Your name is on the door." directions-ready state → reload restored it. localStorage verified: `currentStage: "directions"`, status `confirmed`, `selectedIds: [n1,n2]`, `graveyardIds: [n3,n4,n5]`, 5 candidates + 5 evaluations + confirmedAt. Mock output visibly labeled "Dev preview · mock AI"; mock evaluation text carries "(Mock evaluation)" prefixes.
- Screenshots (`gui-test-screenshots/p3-*`): naming intro, shortlist + Graveyard, directions-ready in light/dark/390px mobile — no horizontal overflow at 390px (programmatic scrollWidth check: 0), themes readable, selection conveyed by outline + label + aria-pressed. (Visual-judge agent was unavailable — provider error — so screenshots were self-inspected; verdict: pass, no repairs.)

### Not verified / limitations
- **Gemini is mocked** (`MOCK_PROVIDER_ENABLED=true`): real model naming quality, prompt adherence (e.g. name length/distinctness), and structured-output compatibility for the new schemas are unverified until a key/model is configured. The mock's `(Mock evaluation)` labels keep fixtures honest.
- **Authentication deferred**: endpoints verified with the dev bypass only; real token verification still pending `TODO(auth-resume)`.
- Directions generation is intentionally NOT implemented (Phase 3 stop point); the directions-ready screen is a placeholder with no generate action.
- Verification-tooling notes: the IAB Playwright click path wedged again (locators resolved, clicks timed out); recovered via the dom_cua node path and a fresh tab, which also re-verified refresh restoration of the idea. `fullPage` screenshots render a tiled artifact in this environment; viewport-only captures were used instead.

### Handoff
- Current milestone: Phase 3 complete; project rests at the Brand Directions-ready state.
- Files changed: backend — schemas/stages.py, prompts/naming.py, services/{gemini,mock_ai}.py, api/naming.py, main.py, tests/{test_naming.py,test_services.py}; frontend — types/project.ts, lib/{project,api,storage}.ts, features/brand/{NamingScreen.tsx (new), StrategyScreen.tsx, Workspace.tsx, Workspace.test.tsx}, styles/app.css; docs — README.md, context/{architecture-context,ui-context,progress-tracker}.md.
- Verified: 58 backend / 19 frontend tests, typecheck, build, real-browser Phase 3 flow with mock provider incl. confirm dialog, reload restore, and storage partition.
- Not yet verified: real Gemini output, real Firebase auth, deployment.
- Blocker / setup needed: Firebase + Gemini configuration still missing (names in .env.example; never values here).
- Next exact action: on request, Phase 4 — two brand directions from the confirmed shortlist (`POST /api/directions`), each referencing one different shortlisted candidate.
- Approximate time remaining: within the 7–8 hour budget.

## Phase 4 completed — Brand Directions (2026-09-27)
- Baseline verified before editing: clean Git at `63ab604`; backend **58 passed**, frontend **19 passed**, typecheck/build passed.
- Implemented the bounded slice: confirmed naming → generate exactly two mapped directions → compare → select/switch one → clay lock modal → persist → **Brand Kit-ready**. No Brand Kit generation or other later-phase feature was implemented.
- Endpoint: `POST /api/directions/generate`, confirmed strategy + only two shortlisted candidates and their evaluations. Canonical ids, exact candidate mapping, strict HEX colors and structured validation; existing identity dependency/limiter and Gemini repair-once/deadline reused. Deterministic mock provides warm circular and forest geometric treatments. No real Gemini setup or Firebase changes.
- State: `directions` (items, selectedDirectionId, status, generatedAt, confirmedAt); revision/stage guards, abort on unmount, retry preserving naming, Phase 3 save migration, interrupted-load recovery. Strategy/naming revisions clear directions; unlock returns to comparison. Future kit invalidation is documented at that transition; there is no kit state yet.
- UI: intro, calm generation state, two desktop bento boards, four labeled swatches each, real-font type previews, CSS wordmark/imagery concepts, voice, exclusive selection, accessible native clay modal with explicit Tab/Shift+Tab wrap, Escape and Cancel, locked ready screen. Existing recorded Graveyard stays available separately and never enters direction generation.
- Final verification: `uv run pytest -q` **74 passed** (existing non-failing Starlette/httpx deprecation warning); `npm run typecheck` passed; `npm test` **26 passed**; `npm run build` passed; `git diff --check` passed. Tests cover request/output validation, repair limits, deterministic mock, shortlist-only transport, blocked entry, selection switching, modal cancellation/confirmation/keyboard cycling, refresh persistence, malformed responses/retry, upstream invalidation and stale response rejection.
- Browser: agent-browser on localhost:5173 with local backend/mock provider. Prepared a Phase 3-format confirmed project from actual mock clarify/strategy/naming/evaluation endpoint responses, then restored it. Clicked Build → exactly two visibly distinct boards → selected A → switched B → Escape/cancel path → lock modal → confirmed → refreshed. Verified persisted `direction2`, `confirmedAt`, status confirmed, currentStage brand-kit and Brand Kit-ready screen. Reopened and relocked to check keyboard focus wrap. Desktop light/dark and 390px mobile light/dark checked; **zero horizontal overflow**; no browser errors or Vite overlay. Screenshots: `gui-test-screenshots/p4-*`.
- One regression found/fixed during testing: the replaced Phase 3 placeholder initially hid the recorded Graveyard; its existing component is now retained alongside directions and the ready screen.
- Remaining: no Phase 4 blocker. Real Gemini generation, real Firebase sign-in and deployment remain deferred/unverified by scope. No claim of live AI output.

### Phase 4 files changed
- Backend: `app/api/directions.py` (new), `app/prompts/directions.py` (new), `app/schemas/stages.py`, `app/services/gemini.py`, `app/services/mock_ai.py`, `app/main.py`, `tests/test_directions.py` (new).
- Frontend: `src/components/ClayModal.tsx` (new), `src/features/brand/DirectionsScreen.tsx` (new), `src/features/brand/DirectionsScreen.test.tsx` (new), `src/features/brand/NamingScreen.tsx`, `src/features/brand/Workspace.tsx`, `src/features/brand/Workspace.test.tsx`, `src/lib/directions.ts` (new), `src/lib/api.ts`, `src/lib/project.ts`, `src/lib/storage.ts`, `src/types/project.ts`, `src/styles/app.css`.
- Docs: `README.md` endpoint list, `context/architecture-context.md`, this tracker. Browser evidence: `gui-test-screenshots/p4-*`.
- Stop point reached: one confirmed direction persists; project is Brand Kit-ready. Wait for the user's next phase request.

## Phase 5 completed — Editable Brand Kit (2026-09-27)
- Implemented `POST /api/brand-kit/generate` with strict schemas, confirmed-input matching, direction palette continuity, 6–10 rules, server canonical IDs, existing auth/limiter/deadline/repair behavior, and deterministic mock output.
- Extended canonical `AakaroProject` with `brandKit.draft`, `brandKit.confirmed`, status, and timestamps. Upstream changes invalidate the kit; stale generation responses are revision-guarded. Confirmation advances to `spellcheck`; no Spellcheck implementation was started.
- Added the clay/bento Brand Kit screen with editable identity fields, four HEX colors, typography, CSS wordmark, imagery, voice patterns, individual rule/rationale editing, and a neutral live preview. Name remains linked to the confirmed candidate. ClayModal confirmation and unlock-to-edit persist locally.
- Verified: **89 backend tests**, **33 frontend tests**, typecheck, build, and `git diff --check`. Browser verified generation with the local mock backend, palette/rules, edits surviving reload, live preview updates, invalid HEX blocking, modal cancel/confirm, Spellcheck-ready persistence, and zero horizontal overflow at desktop and 390px. Real Gemini/Firebase/deployment remain unverified; mock output is visibly labeled `Dev preview · mock AI`.
- Stop point reached: confirmed direction → generate/edit kit → live preview → edit rules → confirm/persist → Spellcheck-ready. Phase 6 remains the next task.

## Phase 6 completed — Brand Spellcheck (2026-09-27)
- Recovered a partially implemented frontend from the interrupted prior session (domain types, `lib/spellcheck.ts`, API client, storage parsing, partial reducer actions) and finished it; the verified backend (106 tests) was not touched.
- Two latent defects found in the recovered code and fixed: the fresh-response validator wrongly required the storage-only `stale` flag (every live review would have been rejected), and apply-fix fell back to first-occurrence replacement on ambiguous matches (now replaces only at recorded offsets or an exactly-once quote — otherwise it refuses and the button explains manual editing).
- `POST /api/spellcheck/review` consumed end to end: deterministic + AI/mock review, degraded `aiReviewed:false` labeling, unknown-rule/quote grounding, zero-issue responses.
- Reducer: full spellcheck state machine (paste/first-paste original, working content, revision-guarded review start/success/failure, apply-fix, complete, new-content, kit navigation). Kit confirm routes to `spellcheck`; kit unlock/confirm clears spellcheck; all upstream invalidation sites reset it; stale in-flight responses cannot commit; manual edits mark reviews stale.
- UI: new `SpellcheckScreen` (clay/bento, light/dark) with paste textarea + counter, status pill, rule-linked issue cards (rule id + confirmed rule text + quote + offsets + explanation + suggestion + replacement), per-issue Apply fix (unavailable when the quote can no longer be located), stale banner, degraded-AI banner, compliant "No rule conflicts found" state, preserved-original disclosure, Markdown download, Print/Save-as-PDF, finish-confirmation state, start-new-check modal, back-to-brand-kit. Print stylesheet hides chrome/controls.
- Verified: **106 backend tests** (unchanged), **51 frontend tests** (18 new: validator/apply-fix/reducer/storage-roundtrip/export + 6 screen tests covering blocked state, kit-linked review call, apply-fix dispatch, zero-issue completion, stale re-check with latest content, export actions), typecheck, build, `git diff --check`. Updated one pre-existing Brand Kit test to the new confirm→Spellcheck hand-off.
- Browser (localhost, dev mock backend): confirm kit → Spellcheck screen; pasted off-brand copy → two `rule3` issues with real rule text, quotes and offsets; Apply fix changed only the working copy ("revolutionary"→"new", "game-changing"→"useful") while the original paste stayed intact; re-check re-grounded offsets on the edited content; second fix → re-check → "No rule conflicts found. 8 of 8 confirmed rules passed"; Finish → "Content confirmed." with locked editor; reload restored the completed state; Markdown download fired; dark theme verified by screenshot; zero horizontal overflow at desktop width. Direct 390px emulation is not available in the in-app browser pane; 390 correctness rests on the same ≤720px single-column breakpoints verified for earlier phases.
- Remaining: real Gemini review run, real Firebase sign-in, deployment — deferred by scope as in earlier phases. No compliance percentage or factual-claim verification is claimed anywhere.
