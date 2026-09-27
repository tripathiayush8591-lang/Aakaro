"""Schemas for the idea -> clarification -> strategy -> naming stages.

Shared string/idea/request constraints live in connection.py so every stage
body stays consistent.
"""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.schemas.connection import Answer, Idea, RequestId

QuestionText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)
]
ShortLabel = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)
]


class ClarifyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requestId: RequestId
    idea: Idea


class ClarificationQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: ShortLabel
    question: QuestionText
    reason: ShortLabel


class ClarifyResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    questions: list[ClarificationQuestion] = Field(min_length=3, max_length=3)


class ClarificationPair(BaseModel):
    """The question/answer pair actually sent downstream; ids stay UI-local."""

    model_config = ConfigDict(extra="forbid")
    question: QuestionText
    answer: Answer


class StrategyGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requestId: RequestId
    idea: Idea
    clarifications: list[ClarificationPair] = Field(min_length=3, max_length=3)


class StrategyAudience(BaseModel):
    model_config = ConfigDict(extra="forbid")
    primary: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)
    ]
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=800)
    ]


class StrategyBrief(BaseModel):
    model_config = ConfigDict(extra="forbid")
    oneLiner: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=240)
    ]
    audience: StrategyAudience
    problem: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=800)
    ]
    promise: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=800)
    ]
    differentiation: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=800)
    ]
    personality: list[ShortLabel] = Field(min_length=3, max_length=3)
    positioning: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=800)
    ]
    namingTerritories: list[ShortLabel] = Field(min_length=2, max_length=4)


NameText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)
]
NoteText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
PointText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)
]
Score = Annotated[int, Field(ge=1, le=5)]


class NamingCandidate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: ShortLabel
    name: NameText
    rationale: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)
    ]
    territory: ShortLabel
    linguisticNote: NoteText | None = None


def require_distinct(candidates: list[NamingCandidate]) -> None:
    ids = [candidate.id for candidate in candidates]
    names = [candidate.name.casefold() for candidate in candidates]
    if len(set(ids)) != len(candidates) or len(set(names)) != len(candidates):
        raise ValueError("candidates must have distinct ids and distinct names")


class NamingCandidatesRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requestId: RequestId
    strategy: StrategyBrief


class NamingCandidatesResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidates: list[NamingCandidate] = Field(min_length=5, max_length=5)

    @model_validator(mode="after")
    def five_distinct(self):
        require_distinct(self.candidates)
        return self


class NamingScores(BaseModel):
    model_config = ConfigDict(extra="forbid")
    distinctiveness: Score
    strategicFit: Score
    memorability: Score
    extensibility: Score


class NamingEvaluation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    candidateId: ShortLabel
    scores: NamingScores
    strengths: list[PointText] = Field(min_length=1, max_length=3)
    risks: list[PointText] = Field(min_length=1, max_length=3)
    verdict: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)
    ]


class NamingEvaluateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requestId: RequestId
    strategy: StrategyBrief
    candidates: list[NamingCandidate] = Field(min_length=5, max_length=5)

    @model_validator(mode="after")
    def five_distinct(self):
        require_distinct(self.candidates)
        return self


class NamingEvaluationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    evaluations: list[NamingEvaluation] = Field(min_length=5, max_length=5)

    @model_validator(mode="after")
    def five_distinct_references(self):
        ids = [evaluation.candidateId for evaluation in self.evaluations]
        if len(set(ids)) != len(ids):
            raise ValueError("evaluations must reference five distinct candidate ids")
        return self


# ---------------------------------------------------------------------------
# Brand directions (Phase 4): exactly two coherent identity directions, one
# per shortlisted naming candidate. Colors are strict #RRGGBB values; every
# rationale must stay grounded in the supplied strategy and evaluation.
# ---------------------------------------------------------------------------

DirectionText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=400)
]
MediumText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)
]
SampleLine = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)
]
HexColor = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=7,
        max_length=7,
        pattern=r"^#[0-9a-fA-F]{6}$",
    ),
]


class ColorDirection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    primary: HexColor
    secondary: HexColor
    accent: HexColor
    background: HexColor
    rationale: DirectionText


class TypographyDirection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    headingStyle: MediumText
    bodyStyle: MediumText
    rationale: DirectionText


class LogoDirection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    approach: MediumText
    rationale: DirectionText


class ImageryDirection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    style: MediumText
    rationale: DirectionText


class VoiceDirection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    traits: list[ShortLabel] = Field(min_length=3, max_length=5)
    sampleLine: SampleLine


class BrandDirection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: ShortLabel
    candidateId: ShortLabel
    conceptName: ShortLabel
    conceptStatement: DirectionText
    personality: list[ShortLabel] = Field(min_length=2, max_length=4)
    colors: ColorDirection
    typography: TypographyDirection
    logoApproach: LogoDirection
    imagery: ImageryDirection
    voice: VoiceDirection


class DirectionsGenerateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requestId: RequestId
    strategy: StrategyBrief
    shortlistedCandidates: list[NamingCandidate] = Field(min_length=2, max_length=2)
    evaluations: list[NamingEvaluation] = Field(min_length=2, max_length=2)

    @model_validator(mode="after")
    def two_evaluated_shortlisted(self):
        require_distinct(self.shortlistedCandidates)
        candidate_ids = {candidate.id for candidate in self.shortlistedCandidates}
        evaluation_ids = {evaluation.candidateId for evaluation in self.evaluations}
        if evaluation_ids != candidate_ids:
            raise ValueError(
                "evaluations must cover exactly the two shortlisted candidates"
            )
        return self


class DirectionsResult(BaseModel):
    model_config = ConfigDict(extra="forbid")
    directions: list[BrandDirection] = Field(min_length=2, max_length=2)

    @model_validator(mode="after")
    def one_direction_per_candidate(self):
        ids = [direction.id for direction in self.directions]
        candidate_ids = [direction.candidateId for direction in self.directions]
        if set(ids) != {"direction1", "direction2"}:
            raise ValueError("directions must use canonical ids direction1 and direction2")
        if len(set(candidate_ids)) != len(candidate_ids):
            raise ValueError("each direction must reference a different candidate")
        return self
