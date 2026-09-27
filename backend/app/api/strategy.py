from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.schemas.connection import Success
from app.schemas.stages import (
    ClarifyRequest,
    ClarifyResult,
    StrategyBrief,
    StrategyGenerateRequest,
)
from app.services.auth import Identity, require_identity

router = APIRouter()


@router.post("/api/idea/clarify", response_model=Success[ClarifyResult])
async def clarify_idea(
    body: ClarifyRequest,
    request: Request,
    identity: Annotated[Identity, Depends(require_identity)],
):
    request.state.request_id = body.requestId
    with request.app.state.limiter.acquire(identity.uid):
        result = await request.app.state.gemini.clarify(body.idea)
    return Success(requestId=body.requestId, data=result)


@router.post("/api/strategy/generate", response_model=Success[StrategyBrief])
async def generate_strategy(
    body: StrategyGenerateRequest,
    request: Request,
    identity: Annotated[Identity, Depends(require_identity)],
):
    request.state.request_id = body.requestId
    with request.app.state.limiter.acquire(identity.uid):
        result = await request.app.state.gemini.strategy(
            body.idea, body.clarifications
        )
    return Success(requestId=body.requestId, data=result)
