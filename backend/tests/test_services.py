import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from firebase_admin import auth
from google.genai.errors import ClientError, ServerError

from app.core.config import Settings
from app.core.errors import AppError
from app.core.limits import UserLimiter
from app.services.auth import FirebaseIdentity
from app.services.gemini import GeminiService


def service(side_effect):
    value = GeminiService(
        Settings(_env_file=None, gemini_api_key="test-only", gemini_model="test-only")
    )
    generate = AsyncMock(side_effect=side_effect)
    value.client = SimpleNamespace(
        aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    )
    return value, generate


async def test_schema_repair_once():
    value, generate = service(
        [
            SimpleNamespace(text="{}"),
            SimpleNamespace(
                text='{"summary":"Summary","possibleAudience":"Students","clarifyingQuestion":"Where?"}'
            ),
        ]
    )
    assert (await value.generate("idea")).summary == "Summary"
    assert generate.await_count == 2
    assert (
        "idea"
        not in generate.call_args.kwargs["config"].system_instruction.split(
            "Previous output"
        )[-1]
    )


async def test_invalid_output_stops_after_two():
    value, generate = service([SimpleNamespace(text="{}"), SimpleNamespace(text="{}")])
    with pytest.raises(AppError) as error:
        await value.generate("idea")
    assert error.value.code == "INVALID_AI_RESPONSE" and generate.await_count == 2


@pytest.mark.parametrize(
    "exception,code,status",
    [
        (ClientError(429, {"error": {"message": "secret"}}), "PROVIDER_QUOTA", 429),
        (
            ClientError(403, {"error": {"message": "secret"}}),
            "PROVIDER_CONFIGURATION",
            503,
        ),
        (
            ServerError(503, {"error": {"message": "secret"}}),
            "PROVIDER_UNAVAILABLE",
            502,
        ),
        (TimeoutError(), "PROVIDER_TIMEOUT", 504),
    ],
)
async def test_provider_categories_no_blind_retry(exception, code, status):
    value, generate = service(exception)
    with pytest.raises(AppError) as error:
        await value.generate("idea")
    assert error.value.code == code and error.value.status == status
    assert "secret" not in error.value.message and generate.await_count == 1


async def test_total_deadline():
    async def slow(**kwargs):
        await asyncio.sleep(2)

    value, _generate = service(slow)
    value.settings.provider_timeout_seconds = 0.02
    with pytest.raises(AppError) as error:
        await value.generate("idea")
    assert error.value.code == "PROVIDER_TIMEOUT"


async def test_missing_configuration():
    with pytest.raises(AppError) as error:
        await GeminiService(Settings(_env_file=None)).generate("idea")
    assert error.value.code == "CONFIGURATION_ERROR"


@pytest.mark.parametrize(
    "exception,code",
    [
        (auth.InvalidIdTokenError("bad"), "INVALID_TOKEN"),
        (auth.ExpiredIdTokenError("expired", cause=None), "TOKEN_EXPIRED"),
    ],
)
def test_admin_error_mapping(monkeypatch, exception, code):
    identity = FirebaseIdentity(
        Settings(_env_file=None, firebase_project_id="test-project")
    )
    identity.app = Mock()
    verify = Mock(side_effect=exception)
    monkeypatch.setattr(auth, "verify_id_token", verify)
    with pytest.raises(AppError) as error:
        identity.verify("test-token")
    assert error.value.code == code
    verify.assert_called_once_with("test-token", app=identity.app, check_revoked=True)


def test_concurrency_released_after_failure():
    limiter = UserLimiter(5, 60)
    with limiter.acquire("uid"):
        with pytest.raises(AppError) as error, limiter.acquire("uid"):
            pass
        assert error.value.code == "REQUEST_IN_PROGRESS"
    with limiter.acquire("uid"):
        pass
