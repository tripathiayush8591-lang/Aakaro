"""Naming stage routes: five candidates, then their separate evaluation."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.schemas.connection import Success
from app.schemas.stages import (
    NamingCandidatesRequest,
    NamingCandidatesResult,
    NamingEvaluateRequest,
    NamingEvaluationResult,
)
from app.services.auth import Identity, require_identity

router = APIRouter()


@router.post(
    "/api/naming/candidates", response_model=Success[NamingCandidatesResult]
)
async def naming_candidates(
    body: NamingCandidatesRequest,
    request: Request,
    identity: Annotated[Identity, Depends(require_identity)],
):
    request.state.request_id = body.requestId
    with request.app.state.limiter.acquire(identity.uid):
        result = await request.app.state.gemini.naming_candidates(body.strategy)
    return Success(requestId=body.requestId, data=result)


@router.post(
    "/api/naming/evaluate", response_model=Success[NamingEvaluationResult]
)
async def naming_evaluate(
    body: NamingEvaluateRequest,
    request: Request,
    identity: Annotated[Identity, Depends(require_identity)],
):
    request.state.request_id = body.requestId
    with request.app.state.limiter.acquire(identity.uid):
        result = await request.app.state.gemini.naming_evaluation(
            body.strategy, body.candidates
        )
    return Success(requestId=body.requestId, data=result)
