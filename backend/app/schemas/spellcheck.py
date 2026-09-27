"""Phase 6 Brand Spellcheck: rule-linked review of pasted content.

The brand kit arrives from the browser; the confirmed copy lives in
browser-local project state, so the server cannot distinguish draft from
confirmed and validates every rule reference against the kit that was sent.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.schemas.brand_kit import BrandKit, StrictModel
from app.schemas.connection import RequestId
from app.schemas.stages import ShortLabel

# Pasted content is preserved verbatim (no trimming) so apply-fix matching and
# the original/current comparison stay exact; blank content is rejected below.
ContentText = Annotated[str, StringConstraints(min_length=1, max_length=8000)]
QuoteText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)
]
SummaryText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=400)
]
IssueText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=400)
]
Severity = Literal["low", "medium", "high"]
IssueCategory = Literal["voice", "language", "messaging", "visual", "consistency"]


class SpellcheckIssue(StrictModel):
    id: str = ""
    source: Literal["deterministic", "ai"]
    ruleId: ShortLabel
    severity: Severity
    category: IssueCategory
    originalText: QuoteText
    start: int | None = None
    end: int | None = None
    explanation: IssueText
    suggestion: IssueText
    replacement: IssueText | None = None

    @model_validator(mode="after")
    def paired_offsets(self):
        if (self.start is None) != (self.end is None):
            raise ValueError("start and end must be supplied together")
        if self.start is not None and self.end is not None and self.end <= self.start:
            raise ValueError("end must be greater than start")
        return self


class ProviderIssue(StrictModel):
    """Untrusted issue shape before grounding checks and canonical ids."""

    ruleId: ShortLabel
    severity: Severity
    category: IssueCategory
    originalText: QuoteText
    explanation: IssueText
    suggestion: IssueText
    replacement: IssueText | None = None


class SpellcheckReviewResult(StrictModel):
    """What the AI provider (or its mock) must return for one review."""

    summary: SummaryText
    issues: list[ProviderIssue] = Field(max_length=5)
    passedRuleIds: list[ShortLabel] = Field(max_length=10)

    @model_validator(mode="after")
    def distinct_passes(self):
        if len(set(self.passedRuleIds)) != len(self.passedRuleIds):
            raise ValueError("passedRuleIds must be distinct")
        return self


class SpellcheckReview(StrictModel):
    summary: SummaryText
    issues: list[SpellcheckIssue] = Field(max_length=12)
    passedRuleIds: list[ShortLabel] = Field(max_length=10)
    aiReviewed: bool
    reviewedAt: str


class SpellcheckReviewRequest(StrictModel):
    requestId: RequestId
    brandKit: BrandKit
    content: ContentText
    deterministicIssues: list[SpellcheckIssue] = Field(
        default_factory=list, max_length=8
    )

    @model_validator(mode="after")
    def grounded_request(self):
        if not self.content.strip():
            raise ValueError("content must contain visible text")
        for issue in self.deterministicIssues:
            if issue.source != "deterministic":
                raise ValueError("deterministicIssues must be rule-based findings")
        return self
