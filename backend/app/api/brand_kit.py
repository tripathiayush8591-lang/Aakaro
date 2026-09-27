from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.schemas.brand_kit import BrandKit, BrandKitGenerateRequest
from app.schemas.connection import Success
from app.services.auth import Identity, require_identity

router = APIRouter()


@router.post("/api/brand-kit/generate", response_model=Success[BrandKit])
async def generate_brand_kit(
    body: BrandKitGenerateRequest,
    request: Request,
    identity: Annotated[Identity, Depends(require_identity)],
):
    request.state.request_id = body.requestId
    with request.app.state.limiter.acquire(identity.uid):
        result = await request.app.state.gemini.brand_kit(
            body.strategy, body.selectedCandidate, body.selectedDirection
        )
    return Success(requestId=body.requestId, data=result)
