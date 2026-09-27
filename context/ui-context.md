# Aakaro: Flexible UI Context

## Status: provisional and intentionally changeable
This file is the single source for PRESENTATION decisions. Colors, typography, spacing, radius, icons, composition, theme, and navigation layout are not locked. The user expects repeated design iterations.
Latest explicit user instructions or supplied design references override provisional defaults. Apply routine visual changes without requesting another approval. Record the adopted direction here; do not force the user to choose a full design system before implementation.

## Stable experience requirements
- User can understand the current stage, next action, selected direction, and saved state.
- All core actions remain accessible: edit, confirm, compare, select, generate, review, apply/keep, export.
- Two directions must be meaningfully comparable and explain their differences.
- Display strategy assumptions and review reasons clearly.
- Show real stage-level loading, success, empty, error, interrupted, and stale states.
- Keep a user's input/output on recoverable failure; provide retry without restarting the journey.
- Text is readable; forms have labels; keyboard focus is visible; selection/error meaning is not conveyed by color alone.
- Layout works on desktop and smaller screens without hidden actions or horizontal page overflow.
- No invented testimonials, metrics, fake activity, or fabricated progress percentages.

## Provisional starting direction (replace freely)
An editorial brand studio: warm neutral surfaces, dark text, restrained accent, generous spacing, clear hierarchy. This is a fallback, not a compulsory aesthetic. Dark, minimal, neo-brutalist, or other styles are acceptable if requested and usable.
No exact font, hex color, component library, or border radius is mandatory.

## Presentation isolation
- Centralize app colors, font families, spacing, radii, borders, and shadows as semantic tokens in a small stylesheet/theme module.
- Example token roles: background, surface, text-primary, text-muted, border, accent, focus, success, warning, error.
- Keep layout and presentational components separate from API services and project state transitions.
- A restyle must not rename API fields, alter model prompts, remove auth, reset saved projects, or change workflow semantics.
- Avoid scattering style choices across context files. Other documents defer to this file.
- Use a small coherent component set; a library is optional. Do not install multiple UI kits by default.

## Suggested screens (reorganize freely)
1. Start/sign-in: concise value proposition and entry action.
2. Guided workspace: idea, clarification, confirmed strategy, two directions with expandable Graveyard, kit, Brand Spellcheck.
3. Final kit: section navigation, previews, text editing, copy, export.
A sidebar, top stepper, tabs, or continuous guided page may express these same stages. Do not build unused analytics/settings/dashboard screens.

## Preview boundaries
App chrome uses Aakaro's own theme. Generated customer-brand colors/fonts apply only inside the preview container. Render a fixed landing hero template and simple text wordmark. A social preview is excluded from the current timebox.
Choose generated font references from a small curated set; do not execute arbitrary model-provided HTML, CSS, scripts, imports, or URLs. Validate palette values. Preview updates from the same kit used by export.
Label previews as concept previews; do not imply a real logo asset or deployed website exists.

## Editing and review
Use direct text editing or compact edit panels. Review issues show the affected text, explanation, replacement, and Apply/Keep actions. User sees when review is outdated after edits. Rechecking is explicit or clearly indicated.
Print/export view hides navigation and controls, includes the current kit, and handles page breaks/readable colors independently of app theme.

## Restyling workflow
1. Read latest reference/user request.
2. Change tokens and relevant presentational components.
3. Preserve current project data and functional actions.
4. Check representative desktop/mobile screens and main workflow.
5. Update the design decision note below.

## Current design decision
- Direction: Phase 1 uses the user's supplied rounded split-card authentication reference: light gray canvas, white card, dark landscape panel, restrained sans-serif typography.
- Google-only sign-in; no login/register switch, password fields, other providers, or animations. User-facing content only on auth; backend/AI diagnostics appear after sign-in.
- Responsive stacked card on mobile. Local SVG landscape avoids remote image dependencies. Colors, typography, spacing, and radii are centralized in `frontend/src/styles/theme.css`.
- Auth page verified in a real local browser at desktop and 390px mobile widths on 2026-09-27. No horizontal overflow or browser errors observed. Presentation remains provisional.

## New feature interactions (presentation remains flexible)
### The Graveyard
Expandable “The Graveyard — alternatives we evaluated” near direction comparison. Show exactly three rejected candidate names and short context-specific reasons. Tombstone icon/playful styling is optional, not a forced theme. Keep two shortlisted options clear and avoid implying the unchosen finalist was one of the three rejected candidates. No revival controls in MVP.

### Brand Spellcheck
Use “Check kit” and “Check my content” modes in the existing review workspace. Provide editable brand rules and a confirmation action. Pasted-content mode includes a labeled textarea, character limit, Check button, issue list, and separate suggested rewrite with Copy/Use rewrite. Preserve original text. Show rule links/reasons, clean results, partial-analysis failures, and stale results. Avoid green “verified” badges for unverified factual claims.

### Say My Name (stretch)
Compact optional name panel with at most two language/region choices. Label results “Preliminary language screening.” Provide Play/Stop only for available matching voices, plus unavailable/uncertain states. Do not show clearance guarantees. It must not interrupt the core wizard or add mandatory steps.
