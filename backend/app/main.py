import logging
import re
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from pydantic_settings import SettingsError
from starlette.exceptions import HTTPException

from app.api.brand_kit import router as brand_kit_router
from app.api.connection import router
from app.api.directions import router as directions_router
from app.api.naming import router as naming_router
from app.api.spellcheck import router as spellcheck_router
from app.api.strategy import router as strategy_router
from app.core.config import Settings
from app.core.errors import AppError
from app.core.limits import UserLimiter
from app.services.auth import FirebaseIdentity
from app.services.gemini import GeminiService
from app.services.mock_ai import MockAakaroAI


def create_app(settings: Settings | None = None) -> FastAPI:
    if settings is None:
        try:
            settings = Settings()
        except (ValidationError, ValueError, SettingsError):
            # Do not print Pydantic's input values (which may contain credentials).
            raise RuntimeError(
                "Invalid server configuration. Check .env field types and CORS_ORIGINS against .env.example."
            ) from None

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        await app.state.gemini.close()
        app.state.identity.close()

    app = FastAPI(title="Aakaro foundation", lifespan=lifespan)
    app.state.settings = settings
    app.state.identity = FirebaseIdentity(settings)
    # Development-only deterministic provider, swapped for Gemini by configuration.
    app.state.gemini = (
        MockAakaroAI() if settings.mock_provider_enabled else GeminiService(settings)
    )
    app.state.limiter = UserLimiter(
        settings.user_request_limit, settings.user_window_seconds
    )

    def failure(request: Request, error: AppError) -> JSONResponse:
        headers = {"WWW-Authenticate": "Bearer"} if error.status == 401 else {}
        return JSONResponse(
            status_code=error.status,
            headers=headers,
            content={
                "requestId": request.state.request_id,
                "error": {
                    "code": error.code,
                    "message": error.message,
                    "retryable": error.retryable,
                },
            },
        )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        supplied = request.headers.get("X-Request-ID", "")
        request.state.request_id = (
            supplied if re.fullmatch(r"[A-Za-z0-9_-]{1,64}", supplied) else str(uuid4())
        )
        try:
            response = await call_next(request)
        except Exception:  # noqa: BLE001 — public boundary must never expose exception details
            logging.getLogger("aakaro").error(
                "Unhandled request failure request_id=%s", request.state.request_id
            )
            response = failure(
                request,
                AppError(
                    500, "INTERNAL_ERROR", "Something went wrong. Try again.", True
                ),
            )
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["Cache-Control"] = "no-store"
        return response

    # Outermost CORS also decorates normalized unexpected failures.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    @app.exception_handler(AppError)
    async def app_error(request: Request, exc: AppError):
        return failure(request, exc)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        return failure(
            request,
            AppError(
                422,
                "VALIDATION_ERROR",
                "Check the request: a request ID, an idea between 1 and 1,000 "
                "characters, exactly three clarification questions with answers, "
                "five naming candidates or evaluations with distinct matching "
                "IDs, spellcheck content between 1 and 8,000 characters, "
                "and no unknown fields are required.",
            ),
        )

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return failure(
            request,
            AppError(
                exc.status_code, "HTTP_ERROR", "This API request is not available."
            ),
        )

    @app.get("/health")
    async def health(request: Request):
        return {"requestId": request.state.request_id, "data": {"status": "ok"}}

    app.include_router(router)
    app.include_router(strategy_router)
    app.include_router(naming_router)
    app.include_router(directions_router)
    app.include_router(brand_kit_router)
    app.include_router(spellcheck_router)
    return app


app = create_app()
