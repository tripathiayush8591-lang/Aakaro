# Aakaro: Agent Instructions

## Read first
Read these files before implementation, in order:
1. `context/project-overview.md`
2. `context/architecture-context.md`
3. `context/ui-context.md`
4. `context/code-standards.md`
5. `context/ai-workflow-rules.md`
6. `context/progress-tracker.md`

## Mission
Build Aakaro: “Give your idea an identity.” Ship a working hackathon MVP within a total 7–8 hour budget, including testing, demo, and submission preparation. Prioritize the complete idea-to-brand journey, The Graveyard naming evaluation, and Brand Spellcheck (kit review plus pasted-content checks). Say My Name is stretch-only and must not delay the core or submission.

## Authority and autonomy
- Follow the latest explicit user instruction over these project defaults.
- These are new Aakaro specifications; uploaded sample-project rules are not dependencies.
- Stack: React + Vite + TypeScript, FastAPI + Pydantic, Firebase Google sign-in, Gemini API, browser-local project persistence.
- Do not introduce Next.js, Clerk, Prisma, Liveblocks, Trigger.dev, a vector database, or cloud project storage by default.
- Make routine reversible implementation decisions independently. Record material assumptions; ask only when a missing decision blocks meaningful progress or materially changes scope/cost.
- Do not treat every missing detail as a blocker or require approval after every stage.
- UI aesthetics are provisional. Apply user-requested restyles directly and update `ui-context.md`; no separate approval gate is needed.
- Do not change API schemas, AI behavior, auth, or storage merely to restyle the interface.

## Execution
- Build small vertical slices and verify real integration early.
- Keep API contracts consistent between Python and TypeScript.
- Never present fixtures as live AI output or claim checks/deployments that did not happen.
- Keep secrets server-side and out of source control.
- Preserve unrelated user work. Prefer narrow changes over broad rewrites.
- Do not launch parallel agents automatically. If the user assigns multiple coding tools, agree on file ownership and contracts first.
- Update `context/progress-tracker.md` after meaningful milestones, including actual verification and remaining blockers.
- Update other context files only when their decisions change. Keep documentation concise.

## Definition of done
A signed-in user can enter an idea, answer clarifications, confirm a strategy, choose one of two directions, inspect three genuinely rejected naming candidates, generate a brand kit, confirm editable brand rules, review/apply specific fixes, check pasted content against those rules, and export. Refresh restores their project in the same browser. Protected APIs verify Firebase identity. Live deployed flow works with real AI. Submission assets are prepared; publishing social posts requires the user's explicit instruction.

## Feature scope guardrails
- The Graveyard and Brand Spellcheck are core. Say My Name is an optional preliminary language screen and pronunciation preview.
- Store actual candidate generation/evaluation results; never invent a rejection history after choosing a name.
- Do not claim “nobody else offers this,” name availability, cultural clearance, or hidden reasoning access.
- No new external paid API is required: reuse Gemini; optional speech uses available browser voices.
- Drop the social preview and extra polish to protect the 7–8 hour total timebox.
