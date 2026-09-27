from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.core.errors import AppError
from app.schemas.connection import ConnectionRequest, ConnectionResult, Success
from app.services.auth import Identity, require_identity

router = APIRouter()


@router.post("/api/connection-test", response_model=Success[ConnectionResult])
async def connection_test(
    body: ConnectionRequest,
    request: Request,
    identity: Annotated[Identity, Depends(require_identity)],
):
    request.state.request_id = body.requestId
    if not request.app.state.settings.connection_test_enabled:
        raise AppError(404, "NOT_FOUND", "The temporary connection test is disabled.")
    with request.app.state.limiter.acquire(identity.uid):
        result = await request.app.state.gemini.generate(body.idea)
    return Success(requestId=body.requestId, data=result)
