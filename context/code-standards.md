# Aakaro: Code Standards

## General
Prefer readable, small modules and direct implementation. Avoid unnecessary frameworks, abstractions, or generated scaffolding. Use installed-version documentation when integrating SDKs. Lock dependency versions after the first successful install. Keep sample data clearly separated from live paths.

## Frontend
- Strict TypeScript; avoid `any`, validate unknown external data.
- Functional React components; separate API/storage/export helpers from visual components.
- One canonical project state using a reducer/context or similarly small state layer; no redundant derived state.
- Central API client attaches current Firebase token and handles normalized errors. Never log tokens.
- Disable duplicate actions while pending and discard stale/session-mismatched responses.
- Catch export and localStorage failures. Avoid raw HTML injection; render model output as safe text.
- Styling follows the flexible `ui-context.md`. No Next.js server components or `next/font` assumptions.

## Backend
- Typed Python functions and Pydantic models at every API/provider boundary.
- Thin FastAPI routes; auth dependency, AI service, prompts, and validation live separately.
- Structured schema validation is required even if provider output mode is enabled.
- Use bounded requests and a singleton/reused SDK client where appropriate.
- Verify Firebase ID tokens server-side before provider calls.
- Use explicit CORS origins, bounded input sizes, output limits, request IDs, and safe error messages.
- Never expose prompts, full sensitive inputs, secrets, or provider stack traces in public errors/logs.
- Health checks do not call the AI provider.

## AI integration
Model output is untrusted data, never executable code. Keep user text separate from system instructions. Select fonts by allowlisted IDs; validate colors and editable field paths. API keys stay server-side. Do not hardcode a supposed latest model or claim unmeasured quality metrics.

## Storage and revisions
Validate schemaVersion and restored fields. Namespace projects by verified frontend auth UID. Invalidate dependent state when upstream decisions change. Apply review suggestions only against the matching revision. No silent data deletion on corruption or error; offer a clear reset/recovery path.

## Verification with purpose
- Backend: verify rejected/missing auth, invalid request/provider output, and normalized failure behavior.
- State: verify upstream invalidation, stale response rejection, and safe fix revision handling.
- Smoke: one real deployed idea-to-export flow, refresh recovery, sign-out/account separation, review and apply/recheck.
- Check failed provider/quota response does not erase work.
- Run frontend typecheck/build and relevant backend tests. Use provider mocks for deterministic tests; reserve real calls for integration checks.
- Do not add tests that merely mirror styling or implementation details. Stop once concrete risks are covered.

## Delivery hygiene
Document startup commands, env placeholders, deployment requirements, AI stages, and limitations in README. Never commit `.env`, service-account JSON, API keys, or local output containing credentials. Record actual test outcomes and known limitations in progress tracker.

## New feature checks
- Validate naming evaluation covers exactly the original five IDs, with two shortlisted and three rejected; directions reference the shortlist correctly.
- Banned-phrase matching is deterministic, case-insensitive, and avoids accidental substring matches where word boundaries apply. Never compile raw user regex.
- Review quotes and rule references must match actual inputs. Preserve original pasted text; reject stale content/rules revisions.
- Test exact phrase findings plus AI failure: partial deterministic results must not appear as a complete successful analysis.
- Confirm brand-rule changes stale both review modes; name changes stale optional language results.
- If speech is implemented, verify unavailable-language fallback, queue cancellation, and stop behavior on the demo device.
- No fake rejection history, usage counts, linguistic certainty, or competitive exclusivity claims.
