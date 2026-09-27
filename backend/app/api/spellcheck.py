from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.core.errors import AppError
from app.schemas.connection import Success
from app.schemas.spellcheck import SpellcheckReview, SpellcheckReviewRequest
from app.services.auth import Identity, require_identity
from app.services.spellcheck import (
    build_review,
    degraded_review,
    find_deterministic_issues,
)

router = APIRouter()

# Provider failures degrade to the rule-based findings instead of failing the
# whole review; the degraded result is explicitly marked so it is never shown
# as a full pass. Configuration errors still surface to the operator.
_DEGRADABLE_STATUSES = {429, 502, 503, 504}


@router.post("/api/spellcheck/review", response_model=Success[SpellcheckReview])
async def review_spellcheck(
    body: SpellcheckReviewRequest,
    request: Request,
    identity: Annotated[Identity, Depends(require_identity)],
):
    request.state.request_id = body.requestId
    with request.app.state.limiter.acquire(identity.uid):
        deterministic = find_deterministic_issues(body.brandKit, body.content)
        try:
            result = await request.app.state.gemini.spellcheck_review(
                body.brandKit, body.content, deterministic
            )
        except AppError as exc:
            if exc.status not in _DEGRADABLE_STATUSES:
                raise
            review = degraded_review(deterministic)
        else:
            review = build_review(
                body.brandKit,
                body.content,
                result,
                deterministic,
                body.deterministicIssues,
            )
    return Success(
        requestId=body.requestId,
        data=review.model_copy(
            update={"reviewedAt": datetime.now(timezone.utc).isoformat()}
        ),
    )
