"""Two identity directions from the user's confirmed naming shortlist."""
from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.schemas.connection import Success
from app.schemas.stages import DirectionsGenerateRequest, DirectionsResult
from app.services.auth import Identity, require_identity

router = APIRouter()


@router.post("/api/directions/generate", response_model=Success[DirectionsResult])
async def generate_directions(
    body: DirectionsGenerateRequest,
    request: Request,
    identity: Annotated[Identity, Depends(require_identity)],
):
    request.state.request_id = body.requestId
    with request.app.state.limiter.acquire(identity.uid):
        result = await request.app.state.gemini.directions(
            body.strategy, body.shortlistedCandidates, body.evaluations
        )
    return Success(requestId=body.requestId, data=result)
