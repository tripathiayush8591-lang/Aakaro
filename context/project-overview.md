# Aakaro: Project Overview

## Identity
- Name: Aakaro
- Tagline: Give your idea an identity.
- Meaning: Inspired by “Aakaar”: giving an idea shape.
- Primary users: First-time founders and student startup teams.
- Promise: Turn a rough idea into a coherent, editable brand identity and practical launch content through guided AI decisions.
- Name availability and trademark clearance have not been verified.

## Problem
Founders struggle to connect audience, positioning, name, personality, visuals, and launch messaging. Separate generation produces generic or contradictory results. Aakaro carries approved decisions through deliberate stages and explains quality issues.

## Locked MVP journey
1. Google sign-in.
2. Enter a rough idea, intended audience if known, and optional constraints/preferences.
3. Answer exactly three focused AI-generated questions in one batch; allow “not sure.”
4. Review and edit a strategy brief: problem, audience, positioning, value proposition, proposed differentiator, and assumptions.
5. Explicitly confirm the brief.
6. Generate five naming candidates, evaluate them separately, and compare two shortlisted brand directions. Expand The Graveyard to see the three rejected candidates and brief reasons.
7. Choose a direction and generate its complete kit.
8. Edit text and inspect fixed-template visual previews.
9. Review and confirm editable brand rules. Use Brand Spellcheck to check the kit or pasted external content; preview suggestions and accept fixes or keep originals.
10. Recheck revised content and export the current kit.

## Required output
- Strategy: audience, problem, positioning, value proposition, differentiator.
- Identity: suggested name, naming rationale, tagline, one-line pitch.
- Personality: three justified traits plus traits/language to avoid.
- Voice: guidance and “say this / avoid this” examples.
- Visual brief: 4–5 colors with roles, curated font pair, logo concept, imagery guidance.
- Launch copy: headline, subheading, CTA, one social announcement.
- Previews: simple typographic wordmark and landing hero; social preview is removed from this timeboxed MVP.
- Review: specific issue, affected field, explanation tied to strategy, suggested replacement.
- Export: Markdown download and browser Print/Save as PDF.

## Differentiator
Consistency review compares the kit with approved strategy and finds audience mismatch, contradictions, and vague/clichéd language. Example: “elite hackers only” conflicts with a beginner-friendly community. Show an actionable replacement with an explanation, not a fabricated quality percentage.

## Scope boundaries
In scope: Google auth, one active project per signed-in user per browser, staged AI, two directions, The Graveyard, editable brand rules, Brand Spellcheck for kit and pasted content, text edits, review/fix, local recovery, export, useful failure states.
Out of scope: email/password flows, payments, collaboration, project dashboard, cloud sync, uploaded documents, live competitor research, domain/trademark checks, image generation, finished vector logos, website generation, multi-agent frameworks, RAG, animation-heavy onboarding.
Names and differentiators are suggestions, not verified market facts. Previews are fixed templates, not deployed customer websites. Local saving is not cloud backup.

## Priorities
P0: Real AI flow, confirmed strategy, evaluated candidates/Graveyard, two directions, kit, editable confirmed brand rules, Brand Spellcheck in both modes, export, working auth and deployment.
P1: Individual fix application/recheck, editing, refresh recovery, readable landing preview; include in normal MVP build.
Stretch only: Say My Name after the core deployed flow is verified and time remains before feature freeze. First cuts: language screening/playback, elaborate styling, extra animations. Social preview is already removed. Never silently replace real AI with fixtures or remove required auth protections.

## Success criteria
- One complete live journey succeeds without manual developer intervention.
- Approved audience/personality are reflected in generated content.
- User can control decisions and understand why a fix is suggested.
- Output is practical, readable, editable, and exportable.
- Failures preserve existing work and offer useful retry paths.

## Hackathon submission checklist
Working deployment, accessible GitHub repo, recommended 2–4 minute actual-product demo, workflow explanation, and specific individual contributions. Every participant needs their own submission and Instagram/LinkedIn posts; LinkedIn requires direct video upload. Follow the handbook for Inkloom description, inkloom.art, INKLOOM-WCC, official tags and @wecodecoderss collaboration request. Inkloom integration is not required. Confirm official deadline/account handles separately; do not invent them.

## The Graveyard — core
Generate exactly five distinct candidates for the confirmed strategy, then evaluate those actual candidates in a separate AI stage. Shortlist two, use them in two different brand directions, and show the remaining three with audience-fit, distinctiveness, or pronunciation trade-offs. Keep candidate IDs and evaluation results together. “Rejected for this brief” does not mean objectively bad.
No fabricated counts such as “1000 apps use this.” No market search is being performed. Position this as visible evaluated alternatives, not proof of private internal reasoning. No restore/revive workflow is required in MVP.

## Brand Spellcheck — core
Extend the existing consistency review with two modes: Check kit and Check my content. Derive an editable rule set from the generated kit; user confirms tone, audience, preferred sentence length, banned words/phrases, and claims to avoid. Store rules with stable IDs.
For a pasted post (up to 3,000 characters), find exact banned phrases with code and use Gemini for tone, audience, contradictions, and potentially unsupported claims. Show the affected quote, rule, reason, and suggested wording. Preserve the original and offer a separate full suggested rewrite with Copy/Use rewrite. Recheck changed content. No posting integration.
A claim such as “find teammates in 2 minutes” needs support even if the tone fits. Brand review cannot independently fact-check it. No fabricated quality percentage. Returning later works only while the same user's local browser project remains available.

## Say My Name — optional stretch
After the core is deployed and verified, allow screening the current name for at most two language/region selections. Return potential concerns, concise reasons, and uncertainty; allow “unable to assess.” Use browser speech synthesis only when a matching voice is available. This is preliminary AI screening and pronunciation exploration, not native-speaker validation, translation certification, or trademark clearance. Never say “safe everywhere.”
No paid TTS, dictionary/research integration, or new accounts. Missing voices disable playback with an honest explanation. Do not use unverified “Peeka” assertions or the Chevrolet Nova sales-failure myth as factual demo evidence.

## Updated demo story
Clarify idea → confirm strategy → compare directions and rejected names → generate kit → confirm rules → paste off-brand copy → show rule-linked corrections → copy/export. Optional pronunciation demo only if actually implemented and working.
