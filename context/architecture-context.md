# Aakaro: Architecture Context

## Stack and boundaries
| Layer | Choice | Responsibility |
|---|---|---|
| Frontend | React + Vite + TypeScript | Wizard, editing, previews, local project state, export |
| Styling | Tailwind CSS / semantic CSS tokens | Adaptable presentation |
| Backend | FastAPI + Pydantic | Authentication, validation, staged AI orchestration |
| Auth | Firebase Authentication + Admin SDK | Google sign-in and server token verification |
| AI | Gemini via official Python SDK | Schema-constrained stage outputs |
| Persistence | localStorage | One project per Firebase UID, in this browser |

Use a currently supported model available to the account via `GEMINI_MODEL`; verify the exact SDK/API at implementation time. No model identifier or dependency version is locked by these documents.

## Suggested repository layout
```text
AGENTS.md
context/
frontend/
  src/
    components/
    features/brand/
    lib/              # API client, Firebase client, storage, export
    types/
    styles/
backend/
  app/
    main.py
    api/
    core/             # configuration, auth, error handling
    schemas/
    services/         # Gemini integration and stage orchestration
    prompts/
  tests/
```
Keep this structure small; folders may be collapsed while responsibilities remain clear.

## Authentication
Frontend obtains a Firebase ID token and sends `Authorization: Bearer <token>` to protected APIs. Backend verifies the token with Firebase Admin for the configured project and derives UID from verified claims. Never trust a body UID for identity. Public health endpoint only; all generation/review endpoints require verified auth. No production auth bypass.
Use SDK-managed auth persistence; do not manually copy tokens into project storage. On logout/account switch, clear in-memory project state and ignore in-flight responses from the old session.
Firebase login does not provide project persistence. Local state is scoped to UID to avoid accidental cross-account display; it is not encrypted storage or server-backed ownership enforcement.

## Data contracts
Implement precise Pydantic schemas and matching TypeScript types before UI integration. Suggested fields:
- `IdeaInput`: idea, optional audience, constraints.
- `ClarificationQuestion`: id, question, optional helper text; exactly 3.
- `ClarificationAnswer`: questionId, answer.
- `StrategyBrief`: problem, audience, positioning, valueProposition, differentiator, assumptions.
- `BrandDirection`: id, candidateId, label, name, namingRationale, tagline, personality, positioningAngle, colorMood, fontPairId, rationale; exactly 2.
- `BrandKit`: strategy, identity, personality, voice, visual, launch, proposedBrandRules.
- `ReviewIssue`: id, fieldPath, severity, explanation, proposedValue, strategyReference.
- `ReviewResult`: kitRevision, rulesRevision, issues, summary; an empty issues list is valid.
- `BrandProject`: schemaVersion, projectId, ownerUid, revision, timestamps, currentStep, idea, questions, answers, confirmedStrategy, namingCandidates, namingEvaluation, directions, selectedDirectionId, kit, brandRules, rulesRevision, rulesConfirmed, review, contentDraft, contentRevision, contentReview, optional languageScreen.
Use a single documented JSON field naming convention and aliases where necessary. Field paths for fixes must be from an explicit editable-field allowlist, not arbitrary object writes.

## Proposed API contract
All stage bodies include `requestId` and the structured upstream inputs needed by that stage. The backend is stateless for project data.
| Method/path | Input | Result data |
|---|---|---|
| GET /health | none | status; no secrets |
| POST /api/clarify | idea | questions |
| POST /api/strategy | idea, questions, answers | strategy |
| POST /api/naming/candidates | confirmed strategy | exactly 5 candidates |
| POST /api/directions | confirmed strategy, generated candidates | evaluation, exactly 2 directions, 3 rejected candidate references |
| POST /api/kit | strategy, selected direction | kit |
| POST /api/review | strategy, kit, kitRevision, confirmed rules, rulesRevision | kit review |
| POST /api/spellcheck | strategy, confirmed rules, rulesRevision, text, contentRevision | issues and suggested rewrite |
| POST /api/name-screen (stretch only) | name, nameRevision, up to 2 locale IDs | preliminary language screen |

Success envelope: `{requestId, data}`. Error envelope: `{requestId, error: {code, message, retryable}}` with an appropriate HTTP status. Normalize validation, auth, provider, timeout, and unexpected failures. Avoid raw exception details in browser responses.
Review returns suggested replacements. Apply accepted fixes locally only if their revision matches the current kit; then rerun review. No extra AI “apply fix” endpoint is necessary.

## State and invalidation
- One canonical project state drives forms, previews, review, and export.
- Editing confirmed strategy invalidates candidates, evaluation, directions, selection, kit, brand rules, and both review modes. Explain consequences before a destructive regeneration.
- Changing selected direction invalidates kit, brand rules, both reviews, and any name screen.
- Editing a kit or applying a fix increments kit revision and marks its previous review stale. Edits affecting tone/audience/personality flag rules for reconfirmation and content review as stale. Name edits invalidate language screening.
- Only the newest matching request/session/revision may commit a response.
- Preserve existing successful output on failure. Do not allow accidental duplicate requests.
- Store under `aakaro:v1:<uid>:active-project`; add optional fields/defaults for these feature extensions without resetting existing projects; validate loaded JSON/schema and handle corrupt/unavailable/quota-exceeded storage with a visible warning.
- Refresh restores stable state; in-flight work becomes interrupted/retryable, never permanently “loading.”

## AI execution and reliability
One bounded request per explicit stage; no queues or background framework for MVP. Use asynchronous SDK calls or move blocking work off the event loop. Set bounded timeouts, output limits, and at most one automated repair/retry appropriate to the error. Honor quota/rate limits and avoid retry storms. Set input length limits and a simple per-user request/concurrency limit; document limits of in-process controls on multi-instance hosts.

## Deployment/configuration
Frontend and backend can deploy separately. Choose hosts early and verify HTTPS, actual AI request duration limits, exact frontend CORS origin, Firebase authorized domains, and backend credentials. Keep hosting choice provisional until tested.
Frontend public configuration: `VITE_API_BASE_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and other required Firebase web config fields.
Backend secrets/config: `GEMINI_API_KEY`, `GEMINI_MODEL`, Firebase Admin credentials using the host-supported mechanism, `FIREBASE_PROJECT_ID`, and `CORS_ORIGINS`.
Firebase web configuration is not an Admin secret. Never put Gemini keys or service-account private keys in `VITE_*` variables. Supply placeholder `.env.example` files and ignore real credentials.

## Feature contracts and validation
- `NamingCandidate`: id, name, intendedAngle, rationale; five distinct IDs/names.
- `NamingEvaluation`: candidateId, disposition (shortlisted/rejected), audienceFit, distinctiveness, pronunciation, decisionReason. Five entries must partition the submitted candidates exactly: two shortlisted, three rejected. Reject new/unknown IDs, duplicate IDs, name substitutions, or missing candidates. Directions each reference one different shortlisted candidate. Keep source candidates/evaluation in project state.
- `BrandRule`: id, kind, description, optional phrases, optional maxSentenceWords. Kinds include tone, audience, bannedPhrase, sentenceLength, unsupportedClaim. Store user-confirmed rules and a rulesRevision separately from generated kit proposals.
- `ContentReview`: contentRevision, rulesRevision, issues, suggestedRewrite, summary.
- `ContentIssue`: id, source (deterministic/ai), quote, ruleId, explanation, suggestedText. Quotes must exist in submitted text; rule IDs must exist. Do not blindly apply character offsets from the model. For external content, MVP uses a separate full rewrite with Copy/Use rewrite, preserving original text; per-issue replacement is optional.
- `LanguageScreen` (optional): name, nameRevision, locale results with status (potentialConcern/noObviousConcern/uncertain), explanation, and limitations. Reject unsupported locales; cap at two.

## Brand Spellcheck execution
Backend runs case-insensitive literal phrase matching with suitable word boundaries, not user-supplied regex. Feed actual matches and confirmed rules into Gemini for contextual issues and a rewrite. Merge/deduplicate results without dropping deterministic violations. If Gemini fails, keep deterministic results and explicitly mark contextual analysis/rewrite unavailable; never label partial analysis as a full pass. Enforce text length and existing auth/rate controls.
Editing rules increments rulesRevision and invalidates both review modes. Editing pasted text increments contentRevision and invalidates its review. Changing pasted text does not alter the brand kit. Content rewrite changes only content state. Outdated review responses cannot overwrite newer inputs. Export the current confirmed rules alongside the kit; no auto-export of pasted drafts.

## Optional speech playback
Use feature-detected browser speech synthesis, get available voices (including asynchronous voice availability), and match the selected locale. Do not silently use an unrelated language voice. Play/Stop must cancel queued utterances on replacement, navigation, and logout. No browser voice is proof of native pronunciation or semantic safety. Hide/disable the entire optional feature until implemented; no dead buttons.
