"""Phase 5 identity system. Confirmation is owned by the browser-local project."""
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.connection import RequestId
from app.schemas.stages import (
    BrandDirection, DirectionText, HexColor, MediumText, NameText,
    NamingCandidate, ShortLabel, StrategyBrief,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class KitIdentity(StrictModel):
    name: NameText
    tagline: MediumText
    descriptor: MediumText


class KitColors(StrictModel):
    primary: HexColor
    secondary: HexColor
    accent: HexColor
    background: HexColor


class KitTypography(StrictModel):
    headingStyle: MediumText
    bodyStyle: MediumText
    usageGuidance: DirectionText


class KitWordmark(StrictModel):
    treatment: MediumText
    casing: Literal["lowercase", "uppercase", "titlecase", "mixed"]
    tracking: Literal["tight", "normal", "wide"]
    weight: Literal["regular", "medium", "semibold", "bold"]


class KitImagery(StrictModel):
    style: MediumText
    guidance: DirectionText


class KitVoice(StrictModel):
    traits: list[ShortLabel] = Field(min_length=3, max_length=5)
    description: DirectionText
    preferredLanguage: list[MediumText] = Field(min_length=3, max_length=6)
    avoidedLanguage: list[MediumText] = Field(min_length=3, max_length=6)


class BrandRule(StrictModel):
    id: ShortLabel
    category: Literal["voice", "language", "messaging", "visual"]
    rule: DirectionText
    rationale: DirectionText


class BrandKit(StrictModel):
    identity: KitIdentity
    colors: KitColors
    typography: KitTypography
    wordmark: KitWordmark
    imagery: KitImagery
    voice: KitVoice
    rules: list[BrandRule] = Field(min_length=6, max_length=10)


class BrandKitGenerateRequest(StrictModel):
    requestId: RequestId
    strategy: StrategyBrief
    selectedCandidate: NamingCandidate
    selectedDirection: BrandDirection

    @model_validator(mode="after")
    def matching_candidate(self):
        if self.selectedDirection.candidateId != self.selectedCandidate.id:
            raise ValueError("direction must reference the selected candidate")
        if self.selectedDirection.id not in {"direction1", "direction2"}:
            raise ValueError("expected a canonical direction")
        return self
