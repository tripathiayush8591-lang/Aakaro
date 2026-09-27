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
- Direction (Phase 2 redesign, adopted 2026-09-27): premium creative branding studio using claymorphism + bento grids, per explicit user direction. Warm cool off-white light theme (#f4f6fb) with deep navy ink (#172033) and cornflower/electric blue primary (#3d5ae8 buttons for AA contrast, #5b7cff highlights); independently designed dark theme (#10131a background, #171c26/#1d2330 surfaces, vibrant blue accents, redesigned clay shadows, no pure black). Controlled accent tints only on specific bento tiles (audience blue, personality lavender, promise lime, naming territories peach); most tiles neutral clay.
- Typography: Manrope Variable (headings 700–800, tight tracking) + DM Sans Variable (body 400–600), self-hosted via @fontsource-variable packages; no serif in the interface.
- Tokens centralized in `theme.css` (single variable set consumed by both themes; `<html data-theme>` set before first paint by an inline script in index.html using localStorage `aakaro:theme`, falling back to system preference). Theme transitions 250ms on colors/shadows only; `prefers-reduced-motion` disables animation.
- Clay system: radii 10–28px, layered shadows (outer + secondary + inset highlight) as tokens (--shadow-clay, -hover, -pressed, -primary). Depth reserved for buttons, tiles, progress dots, and the theme toggle; inputs keep visible borders with inset surfaces.
- Layout: sticky translucent navbar (wordmark + dev badge + ThemeToggle + Start over + session/sign-out), horizontal stage-rail progress strip below it (clay dots, current = blue, done = lime check), centered 1320px container. Idea/Clarify use a 2-column bento (large interaction tile + supporting stack); strategy review uses a 3-column bento with varied spans (one-liner 2-col, promise 2-col, differentiation full-width) and per-tile click-to-edit with a hover pencil affordance (always visible on touch). Breakpoints: ≤1024px two-column/stacked, ≤720px single column with compact rail (numbers only, current label visible) and hidden session block.
- Auth page keeps the Phase 1 split-card structure restyled with the same tokens.
- Dev mode shows a "Dev preview · mock AI" badge so mocked output is visibly labeled.
- Verified in-browser at 1440/768/390 in both themes: no horizontal overflow, theme persists across reload, disabled/hover/focus states styled. Screenshots in `gui-test-screenshots/r1–r9`.
- Naming (Phase 3, adopted 2026-09-27): intro reuses the locked-hero (headline "Strategy locked.") plus locked-strategy tiles (one-liner span-2, audience blue, territories peach span-2) and an expectations tip tile; primary CTA "Generate 5 names" (user-initiated, never auto-fired). Generation/evaluation reuse the calm clay-stack status pattern with stage-specific status lines and honest "saved while you wait" notes. Shortlist view: heading "Five names, evaluated.", a live status pill ("n of 2 shortlisted"), five candidate cards in a 3-col bento (≤1024px 2-col, ≤720px 1-col) — each card: territory eyebrow, pill select button top-right ("Shortlist" / "Shortlisted ✓" with aria-pressed; disabled with explanatory title when two are chosen), display name, rationale, optional italic linguistic note, 2×2 inset score grid (label + n/5 + primary bar), ✓ strengths / △ risks mini-lists, and a verdict above a divider; selected cards get a primary outline (selection is conveyed by outline + button label + aria-pressed, never color alone). Confirm button stays disabled until exactly two are chosen.
- Directions-ready stop point (Phase 3): hero "Your name is on the door.", two shortlisted tiles (first blue, second lime tint) with rationale + verdict, collapsed Graveyard bar, and a tip tile noting brand directions are next; secondary "Unlock strategy (restarts naming)" with a confirm dialog.

## New feature interactions (presentation remains flexible)
### The Graveyard
Expandable “The Graveyard — alternatives we evaluated” near direction comparison. Show exactly three rejected candidate names and short context-specific reasons. Tombstone icon/playful styling is optional, not a forced theme. Keep two shortlisted options clear and avoid implying the unchosen finalist was one of the three rejected candidates. No revival controls in MVP.
Implemented (Phase 3): dashed-border inset section with a full-width toggle (tombstone SVG, count badge, chevron, aria-expanded). Appears once two names are shortlisted (expanded, entries labeled "will be recorded when you confirm") and stays on the directions-ready screen (collapsed by default, entries labeled "Recorded when you confirmed your naming decision. Rejected for this brief — not objectively bad."). Each entry: name, territory, evaluation verdict, and its stored risks. Reasons always come from the actual stored evaluation — never fabricated after the fact.

### Brand Spellcheck
Use “Check kit” and “Check my content” modes in the existing review workspace. Provide editable brand rules and a confirmation action. Pasted-content mode includes a labeled textarea, character limit, Check button, issue list, and separate suggested rewrite with Copy/Use rewrite. Preserve original text. Show rule links/reasons, clean results, partial-analysis failures, and stale results. Avoid green “verified” badges for unverified factual claims.

### Say My Name (stretch)
Compact optional name panel with at most two language/region choices. Label results “Preliminary language screening.” Provide Play/Stop only for available matching voices, plus unavailable/uncertain states. Do not show clearance guarantees. It must not interrupt the core wizard or add mandatory steps.
