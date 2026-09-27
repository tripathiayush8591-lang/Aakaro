from unittest.mock import AsyncMock, Mock

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app
from app.schemas.connection import ConnectionResult
from app.services.auth import Identity


@pytest.fixture
def setup():
    app = create_app(Settings(_env_file=None, user_request_limit=2))
    app.state.identity = Mock(verify=Mock(return_value=Identity("verified-user")))
    app.state.gemini = Mock(
        generate=AsyncMock(
            return_value=ConnectionResult(
                summary="A teammate finder.",
                possibleAudience="Students.",
                clarifyingQuestion="Which schools?",
            )
        ),
        close=AsyncMock(),
    )
    with TestClient(app, raise_server_exceptions=False) as client:
        yield app, client


def test_health_and_missing_auth_do_not_call_provider(setup):
    app, client = setup
    health = client.get("/health")
    assert health.status_code == 200 and health.json()["data"] == {"status": "ok"}
    result = client.post(
        "/api/connection-test", json={"requestId": "test", "idea": "hello"}
    )
    assert (
        result.status_code == 401 and result.json()["error"]["code"] == "AUTH_REQUIRED"
    )
    app.state.gemini.generate.assert_not_called()
    app.state.identity.verify.assert_not_called()


@pytest.mark.parametrize("code", ["INVALID_TOKEN", "TOKEN_EXPIRED"])
def test_rejected_identity_never_calls_ai(setup, code):
    app, client = setup
    app.state.identity.verify.side_effect = AppError(401, code, "Sign in again.")
    response = client.post(
        "/api/connection-test",
        headers={"Authorization": "Bearer bad"},
        json={"requestId": "r", "idea": "hello"},
    )
    assert response.status_code == 401 and response.json()["error"]["code"] == code
    app.state.gemini.generate.assert_not_called()


@pytest.mark.parametrize(
    "body",
    [
        {"requestId": "r", "idea": "  "},
        {"requestId": "r", "idea": "a" * 1001},
        {"requestId": "!", "idea": "hello"},
        {"requestId": "r", "idea": "hello", "uid": "attacker"},
    ],
)
def test_validation(setup, body):
    app, client = setup
    response = client.post(
        "/api/connection-test", headers={"Authorization": "Bearer valid"}, json=body
    )
    assert response.status_code == 422
    app.state.gemini.generate.assert_not_called()


def test_success_trim_request_id_and_limit(setup):
    app, client = setup
    for _ in range(2):
        response = client.post(
            "/api/connection-test",
            headers={"Authorization": "Bearer valid"},
            json={"requestId": "r", "idea": "  hello  "},
        )
        assert response.status_code == 200 and response.json()["requestId"] == "r"
        assert response.headers["x-request-id"] == "r"
    app.state.gemini.generate.assert_awaited_with("hello")
    assert (
        client.post(
            "/api/connection-test",
            headers={"Authorization": "Bearer valid"},
            json={"requestId": "r", "idea": "hello"},
        ).status_code
        == 429
    )
    assert app.state.gemini.generate.await_count == 2


def test_safe_unexpected_error_and_cors(setup):
    app, client = setup
    app.state.gemini.generate.side_effect = RuntimeError("private provider secret")
    response = client.post(
        "/api/connection-test",
        headers={"Authorization": "Bearer valid", "Origin": "http://localhost:5173"},
        json={"requestId": "r", "idea": "hello"},
    )
    assert response.status_code == 500
    assert "private" not in response.text
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    rejected = client.options(
        "/api/connection-test",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert "access-control-allow-origin" not in rejected.headers


def test_disabled_diagnostic(setup):
    app, client = setup
    app.state.settings.connection_test_enabled = False
    assert (
        client.post(
            "/api/connection-test",
            headers={"Authorization": "Bearer valid"},
            json={"requestId": "r", "idea": "hello"},
        ).status_code
        == 404
    )
    app.state.gemini.generate.assert_not_called()
