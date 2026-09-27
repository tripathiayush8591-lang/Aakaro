"""Development-only deterministic stand-in for GeminiService.

Enabled explicitly with MOCK_PROVIDER_ENABLED=true (never the default, never in
production). It returns schema-valid, idea-dependent fixtures so product work
can proceed without provider credentials. The UI labels this mode visibly.
"""

import asyncio

from app.schemas.brand_kit import BrandKit
from app.schemas.connection import ConnectionResult
from app.schemas.spellcheck import SpellcheckIssue, SpellcheckReviewResult
from app.schemas.stages import (
    BrandDirection,
    ClarificationPair,
    ClarifyResult,
    DirectionsResult,
    NamingCandidate,
    NamingCandidatesResult,
    NamingEvaluation,
    NamingEvaluationResult,
    StrategyBrief,
)

_RESPONSE_DELAY_SECONDS = 0.6


class _Persona:
    def __init__(
        self,
        keywords: tuple[str, ...],
        questions: tuple[tuple[str, str], ...],
        territories: tuple[str, ...],
        personality: tuple[str, str, str],
        positioning: str,
    ):
        self.keywords = keywords
        self.questions = questions
        self.territories = territories
        self.personality = personality
        self.positioning = positioning


_PERSONAS = (
    _Persona(
        ("teammate", "hackathon", "student", "college", "campus"),
        (
            (
                "Who feels this problem most strongly: first-time hackathon participants, experienced competitors, or college clubs organising teams?",
                "The strongest audience decides the voice and the words the name must own.",
            ),
            (
                "What should make joining a team here meaningfully different from posting in campus groups or Discord servers?",
                "Differentiation is what the name and tagline must hint at.",
            ),
            (
                "Should the brand feel energetic and competitive, collaborative and welcoming, or professional and career-oriented?",
                "Personality steers tone, color, and naming style together.",
            ),
        ),
        ("Team Spark", "Coined & Friendly", "Campus Rituals"),
        ("Welcoming", "Skills-First", "Campus-Grown"),
        "The welcoming teammate-finder for campus builders, standing apart from noisy group chats by matching on skills and intent.",
    ),
    _Persona(
        ("market", "buy", "sell", "shop", "store", "product"),
        (
            (
                "Who is this marketplace really for: individual sellers, small local businesses, or collectors with a niche?",
                "The seller audience shapes how premium or everyday the brand should feel.",
            ),
            (
                "What frustrates people most about the way they buy or sell this today?",
                "The sharpest pain point becomes the promise the brand leads with.",
            ),
            (
                "Should the brand feel like a trusted craftsman, a playful bazaar, or a minimal modern storefront?",
                "Personality steers tone, color, and naming style together.",
            ),
        ),
        ("Trusted Hands", "The Modern Stall", "Coined & Light"),
        ("Trusted", "Crafted", "Modern"),
        "The focused storefront for its niche, standing apart from crowded general marketplaces by keeping exchange simple and trustworthy.",
    ),
    _Persona(
        ("write", "content", "newsletter", "blog", "creator", "video"),
        (
            (
                "Who are you making this for: hobbyist creators, professionals building an audience, or teams publishing together?",
                "The creator's ambition level changes how bold the brand can be.",
            ),
            (
                "What should people get from your content that they cannot get from the channels they already follow?",
                "The distinct payoff is what the name must be able to carry.",
            ),
            (
                "Should the brand voice feel like a sharp editor, a generous mentor, or a curious explorer?",
                "Personality steers tone, color, and naming style together.",
            ),
        ),
        ("Plain Spoken", "The Long Game", "Coined & Sharp"),
        ("Sharp Editor", "Generous Mentor", "Curious Explorer"),
        "The publishing home for voices with a point of view, standing apart from algorithm-fed feeds with a clear editorial identity.",
    ),
    _Persona(
        (),
        (
            (
                "Who feels this problem most acutely in their day-to-day life?",
                "The strongest audience decides the voice and the words the name must own.",
            ),
            (
                "What should make this meaningfully better than the workaround people use today?",
                "Differentiation is what the name and tagline must hint at.",
            ),
            (
                "Should the brand feel calm and dependable, bold and energetic, or warm and human?",
                "Personality steers tone, color, and naming style together.",
            ),
        ),
        ("Plain Spoken", "Coined & Warm", "The New Standard"),
        ("Calm", "Dependable", "Human"),
        "The focused answer for its audience, standing apart from generic tools by doing one important thing well.",
    ),
)


def _persona(idea: str) -> _Persona:
    lowered = idea.lower()
    for persona in _PERSONAS:
        if any(keyword in lowered for keyword in persona.keywords):
            return persona
    return _PERSONAS[-1]


def _lead(territory: str) -> str:
    word = territory.split()[0].strip(",&").capitalize() if territory.split() else ""
    return word or "Aaka"


# Deterministic mock names: one stem per territory, five distinct name styles.
_SUFFIXES = ("ly", "ora", "Spot", "craft", "Loop")
_SCORES = (
    {"distinctiveness": 4, "strategicFit": 5, "memorability": 4, "extensibility": 4},
    {"distinctiveness": 3, "strategicFit": 4, "memorability": 5, "extensibility": 3},
    {"distinctiveness": 5, "strategicFit": 3, "memorability": 4, "extensibility": 5},
    {"distinctiveness": 3, "strategicFit": 4, "memorability": 3, "extensibility": 4},
    {"distinctiveness": 4, "strategicFit": 5, "memorability": 4, "extensibility": 3},
)

# Development fixture: plain swaps for a few common inflated words so mock
# reviews can offer a concrete replacement. Phrases without an entry are
# reported without one.
_PLAIN_SWAPS = {
    "revolutionary": "new",
    "game-changing": "useful",
    "best-in-class": "strong",
    "cutting-edge": "modern",
    "disruptive": "different",
    "world-class": "solid",
    "seamless": "smooth",
    "leverage": "use",
    "synergy": "teamwork",
    "effortless": "simple",
    "10x": "much faster",
}


class MockAakaroAI:
    """Same surface as GeminiService; swap-in requires no UI or route changes."""

    async def _delay(self) -> None:
        await asyncio.sleep(_RESPONSE_DELAY_SECONDS)

    async def generate(self, idea: str) -> ConnectionResult:
        await self._delay()
        return ConnectionResult(
            summary=f"A rough idea about {idea[:60]}.",
            possibleAudience="An early community of interested users (mock).",
            clarifyingQuestion="Who do you imagine using this first?",
        )

    async def clarify(self, idea: str) -> ClarifyResult:
        await self._delay()
        persona = _persona(idea)
        return ClarifyResult(
            questions=[
                {"id": f"q{index}", "question": question, "reason": reason}
                for index, (question, reason) in enumerate(persona.questions, start=1)
            ]
        )

    async def strategy(
        self, idea: str, clarifications: list[ClarificationPair]
    ) -> StrategyBrief:
        await self._delay()
        pairs = [
            pair
            if isinstance(pair, ClarificationPair)
            else ClarificationPair.model_validate(pair)
            for pair in clarifications
        ]
        persona = _persona(idea)
        audience_answer = pairs[0].answer
        problem_answer = pairs[1].answer
        differentiation_answer = pairs[2].answer
        audience_primary = audience_answer[:160] or "The core audience"
        return StrategyBrief(
            oneLiner=f"A brand for {audience_primary[:80]}, built from your idea about {idea[:80]}. (Mock strategy for development.)",
            audience={
                "primary": audience_primary,
                "description": f"From your answers: {audience_answer[:400]}",
            },
            problem=f"From your answers: {problem_answer[:400]}",
            promise=f"Deliver clearly on what you described: {idea[:200]}",
            differentiation=f"From your answers: {differentiation_answer[:400]}",
            personality=list(persona.personality),
            positioning=persona.positioning,
            namingTerritories=list(persona.territories),
        )

    async def naming_candidates(self, strategy: StrategyBrief) -> NamingCandidatesResult:
        await self._delay()
        territories = list(strategy.namingTerritories) + ["Plain Spoken", "Coined & Warm"]
        territory = [territories[0], territories[1], territories[0], territories[1], territories[0]]
        stems = [_lead(t) for t in territory]
        names: list[str] = []
        for stem, suffix in zip(stems, _SUFFIXES, strict=False):
            name = f"{stem}{suffix}"
            while name.casefold() in {existing.casefold() for existing in names}:
                name += "o"
            names.append(name)
        return NamingCandidatesResult(
            candidates=[
                NamingCandidate(
                    id=f"n{index}",
                    name=names[index - 1],
                    territory=territory[index - 1],
                    rationale=(
                        f"Mock candidate {index} from the {territory[index - 1]} territory, "
                        f"aimed at {strategy.audience.primary[:60]}: {strategy.promise[:120]}"
                    ),
                    linguisticNote=(
                        "Pronounced exactly as spelled." if index % 2 == 1 else None
                    ),
                )
                for index in range(1, 6)
            ]
        )

    async def naming_evaluation(
        self, strategy: StrategyBrief, candidates: list[NamingCandidate]
    ) -> NamingEvaluationResult:
        await self._delay()
        audience = strategy.audience.primary[:60]
        strengths = [
            f"Speaks directly to {audience}.",
            "Short, concrete, and easy to say aloud.",
            f"Leaves room beyond the first idea: {strategy.differentiation[:80]}",
        ]
        risks = [
            "Could blend in with similarly named tools.",
            "Pronunciation may vary across languages.",
            f"May feel narrow if the promise shifts: {strategy.promise[:80]}",
        ]
        return NamingEvaluationResult(
            evaluations=[
                NamingEvaluation(
                    candidateId=candidate.id,
                    scores=_SCORES[index % 5],
                    strengths=[strengths[index % 3], strengths[(index + 1) % 3]],
                    risks=[risks[index % 3], risks[(index + 2) % 3]],
                    verdict=(
                        f"(Mock evaluation) Works best for {audience} when "
                        f"{strategy.differentiation[:80]}. Main trade-off: {risks[index % 3]}"
                    )[:300],
                )
                for index, candidate in enumerate(candidates)
            ]
        )

    async def directions(
        self, strategy: StrategyBrief, shortlisted: list[NamingCandidate],
        evaluations: list[NamingEvaluation],
    ) -> DirectionsResult:
        await self._delay()
        by_id = {e.candidateId: e for e in evaluations}
        directions = []
        for index, candidate in enumerate(shortlisted):
            evaluation = by_id[candidate.id]
            warm = index == 0
            directions.append({
                "id": f"direction{index + 1}",
                "candidateId": candidate.id,
                "conceptName": "An open invitation" if warm else "Room to move",
                "conceptStatement": (
                    f"{candidate.name} as {'a welcoming meeting place' if warm else 'a confident system of building blocks'} "
                    f"for {strategy.audience.primary[:75]}. "
                    f"Develops the name's angle: {candidate.rationale[:110]}"
                ),
                "personality": strategy.personality,
                "colors": {
                    "primary": "#813F2D" if warm else "#203F3A",
                    "secondary": "#DBAC87" if warm else "#A8C2B4",
                    "accent": "#F1CB68" if warm else "#D8EF69",
                    "background": "#FFF4E7" if warm else "#EFF5EE",
                    "rationale": (
                        "Clay, apricot and warm paper make an inviting editorial setting; "
                        "dark clay anchors headings and gold marks small moments of emphasis."
                        if warm else
                        "Deep forest anchors the type, sage separates sections and sharp lime "
                        "marks actions; pale space keeps the modular composition clear."
                    ),
                },
                "typography": {
                    "headingStyle": "Manrope bold, tight lowercase" if warm else "DM Sans medium, spaced uppercase",
                    "bodyStyle": "DM Sans regular, open line spacing" if warm else "Manrope regular, compact paragraphs",
                    "rationale": f"Keeps the name legible while supporting {strategy.personality[0][:60]} character.",
                },
                "logoApproach": {
                    "approach": "Lowercase wordmark with an open circular symbol" if warm else "Uppercase wordmark with an offset square symbol",
                    "rationale": f"A distinct silhouette responds to this evaluation risk: {evaluation.risks[0]}",
                },
                "imagery": {
                    "style": "Overlapping rounded circles, generous paper margins" if warm else "Offset geometric blocks, deliberate grid rhythm",
                    "rationale": f"A visual frame for the positioning: {strategy.positioning[:240]}",
                },
                "voice": {
                    "traits": ["Inviting", "Conversational", "Grounded"] if warm else ["Direct", "Purposeful", "Encouraging"],
                    "sampleLine": f"{'Make room for your next idea with' if warm else 'Your next step starts with'} {candidate.name}.",
                },
            })
        return DirectionsResult.model_validate({"directions": directions})

    async def brand_kit(
        self, strategy: StrategyBrief, candidate: NamingCandidate, direction: BrandDirection,
    ) -> BrandKit:
        await self._delay()
        heading = direction.typography.headingStyle.lower()
        rules = [
            ("voice", "Address the reader as 'you' in invitations.", "Keeps the relationship conversational."),
            ("voice", "Keep each call to action to one active verb and its object.", "Makes the next step concrete."),
            ("language", "Avoid 'revolutionary', 'game-changing', and 'best-in-class'.", "Confidence should not depend on inflated claims."),
            ("language", "Explain specialist terms in everyday words on first use.", f"Welcomes {strategy.audience.primary[:100]}."),
            ("messaging", f"Lead headlines with this outcome: {strategy.promise[:180]}", "Keeps the promise ahead of features."),
            ("messaging", "Do not promise numeric results without a cited source.", "The strategy supplies no measured performance evidence."),
            ("visual", f"Use {direction.colors.primary} for wordmarks and {direction.colors.background} for the main canvas.", "Carries the locked direction into everyday layouts."),
            ("visual", "Reserve the accent color for the primary call to action.", "Gives each composition one clear next step."),
        ]
        return BrandKit.model_validate({
            "identity": {"name": candidate.name, "tagline": direction.voice.sampleLine,
                         "descriptor": strategy.oneLiner[:200]},
            "colors": direction.colors.model_dump(exclude={"rationale"}),
            "typography": {"headingStyle": direction.typography.headingStyle,
                           "bodyStyle": direction.typography.bodyStyle,
                           "usageGuidance": "Use display type for short headlines; use body type for explanations with 1.6 line spacing."},
            "wordmark": {"treatment": direction.logoApproach.approach,
                         "casing": "uppercase" if "uppercase" in heading else "lowercase",
                         "tracking": "wide" if "spaced" in heading else "tight",
                         "weight": "bold" if "bold" in heading else "medium"},
            "imagery": {"style": direction.imagery.style, "guidance": direction.imagery.rationale},
            "voice": {"traits": direction.voice.traits,
                      "description": f"Speak to {strategy.audience.primary[:100]} with {', '.join(direction.voice.traits).lower()} phrasing. Lead with a useful next step.",
                      "preferredLanguage": ["Active verbs", "Direct second-person invitations", "Concrete descriptions of outcomes", "Short sentences with one point"],
                      "avoidedLanguage": ["Corporate jargon", "Revolutionary or game-changing", "Unsupported numeric promises", "Exclusionary labels for beginners"]},
            "rules": [{"id": f"rule{i}", "category": category, "rule": rule, "rationale": why}
                      for i, (category, rule, why) in enumerate(rules, 1)],
        })

    async def spellcheck_review(
        self, kit: BrandKit, content: str, deterministic: list[SpellcheckIssue],
    ) -> SpellcheckReviewResult:
        """Deterministic stand-in: reviews the actual submitted kit and content.

        The rule-based findings computed from the same kit/content are echoed
        back as AI-review issues, with a concrete replacement when the mock's
        plain-swap table covers the phrase. Compliant content yields an empty
        issue list and every rule id as passed — never unrelated fixed issues.
        """
        await self._delay()
        if not deterministic:
            # The mock stays self-sufficient: even without route-computed
            # findings it reviews the actual submitted kit and content.
            from app.services.spellcheck import find_deterministic_issues

            deterministic = find_deterministic_issues(kit, content)
        rules = {rule.id: rule.rule for rule in kit.rules}
        issues = []
        for issue in deterministic[:3]:
            swap = _PLAIN_SWAPS.get(issue.originalText.casefold())
            replacement = None
            if swap is not None:
                replacement = (
                    swap.capitalize() if issue.originalText[:1].isupper() else swap
                )
            issues.append({
                "ruleId": issue.ruleId,
                "severity": issue.severity,
                "category": issue.category,
                "originalText": issue.originalText,
                "explanation": (
                    f"(Mock review) '{issue.originalText}' conflicts with "
                    f"{issue.ruleId}: {rules[issue.ruleId]}"
                )[:400],
                "suggestion": "Use plain wording that fits the confirmed voice.",
                "replacement": replacement,
            })
        failed = {issue["ruleId"] for issue in issues}
        summary = (
            f"(Mock review) {len(issues)} phrase(s) conflict with your confirmed rules."
            if issues
            else "(Mock review) The content follows the confirmed rules in your kit."
        )
        return SpellcheckReviewResult(
            summary=summary,
            issues=issues,
            passedRuleIds=[rule.id for rule in kit.rules if rule.id not in failed],
        )

    async def close(self) -> None:
        return None
