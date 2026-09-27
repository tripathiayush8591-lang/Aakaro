"""Development-only deterministic stand-in for GeminiService.

Enabled explicitly with MOCK_PROVIDER_ENABLED=true (never the default, never in
production). It returns schema-valid, idea-dependent fixtures so product work
can proceed without provider credentials. The UI labels this mode visibly.
"""

import asyncio

from app.schemas.connection import ConnectionResult
from app.schemas.stages import (
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
                    ),
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

    async def close(self) -> None:
        return None
