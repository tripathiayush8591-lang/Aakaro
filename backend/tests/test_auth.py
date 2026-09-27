from unittest.mock import AsyncMock, Mock
import pytest
from fastapi.testclient import TestClient
from firebase_admin import auth

from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app
from app.schemas.connection import ConnectionResult
from app.services.auth import FirebaseIdentity, Identity, require_identity


@pytest.fixture
def auth_app():
    settings = Settings(
        _env_file=None,
        firebase_project_id="test-project",
        user_request_limit=3,
        user_window_seconds=60,
    )
    app = create_app(settings)
    app.state.gemini = Mock(
        clarify=AsyncMock(return_value=Mock(questions=[])),
        generate=AsyncMock(
            return_value=ConnectionResult(
                summary="summary",
                possibleAudience="audience",
                clarifyingQuestion="question",
            )
        ),
        close=AsyncMock(),
    )
    return app


def test_no_authorization_header_returns_401(auth_app):
    with TestClient(auth_app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/connection-test", json={"requestId": "r", "idea": "test idea"}
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "AUTH_REQUIRED"
        assert "Sign in with Google" in data["error"]["message"]


@pytest.mark.parametrize(
    "header_value",
    [
        "Basic dXNlcjpwYXNz",
        "Bearer",
        "Bearer   ",
        "Token abc",
        "Bearer " + "a" * 16385,
        "SomethingElse token",
    ],
)
def test_malformed_bearer_header_returns_401(auth_app, header_value):
    with TestClient(auth_app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/connection-test",
            headers={"Authorization": header_value},
            json={"requestId": "r", "idea": "test idea"},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "INVALID_TOKEN"


def test_invalid_firebase_token_returns_401(auth_app, monkeypatch):
    verify = Mock(side_effect=auth.InvalidIdTokenError("Invalid token signature"))
    monkeypatch.setattr(auth, "verify_id_token", verify)
    auth_app.state.identity.app = Mock()

    with TestClient(auth_app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/connection-test",
            headers={"Authorization": "Bearer bad-token"},
            json={"requestId": "r", "idea": "test idea"},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "INVALID_TOKEN"


def test_expired_firebase_token_returns_401_token_expired(auth_app, monkeypatch):
    verify = Mock(side_effect=auth.ExpiredIdTokenError("Token expired", cause=None))
    monkeypatch.setattr(auth, "verify_id_token", verify)
    auth_app.state.identity.app = Mock()

    with TestClient(auth_app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/connection-test",
            headers={"Authorization": "Bearer expired-token"},
            json={"requestId": "r", "idea": "test idea"},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "TOKEN_EXPIRED"
        assert "expired" in data["error"]["message"].lower()


def test_revoked_firebase_token_returns_401(auth_app, monkeypatch):
    verify = Mock(side_effect=auth.RevokedIdTokenError("Token revoked"))
    monkeypatch.setattr(auth, "verify_id_token", verify)
    auth_app.state.identity.app = Mock()

    with TestClient(auth_app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/connection-test",
            headers={"Authorization": "Bearer revoked-token"},
            json={"requestId": "r", "idea": "test idea"},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == "INVALID_TOKEN"


def test_valid_firebase_token_returns_verified_uid(auth_app, monkeypatch):
    verify = Mock(return_value={"uid": "firebase-user-123", "email": "user@example.com"})
    monkeypatch.setattr(auth, "verify_id_token", verify)
    auth_app.state.identity.app = Mock()

    with TestClient(auth_app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/connection-test",
            headers={"Authorization": "Bearer valid-token"},
            json={"requestId": "r", "idea": "test idea"},
        )
        assert response.status_code == 200
        verify.assert_called_once_with("valid-token", app=auth_app.state.identity.app, check_revoked=True)


def test_dev_bypass_off_by_default():
    settings = Settings(_env_file=None)
    assert settings.dev_auth_enabled is False


def test_dev_bypass_works_only_when_explicitly_enabled():
    settings = Settings(_env_file=None, dev_auth_enabled=True, mock_provider_enabled=True)
    app = create_app(settings)
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/idea/clarify",
            json={"requestId": "r", "idea": "test idea"},
        )
        assert response.status_code == 200


def test_production_environment_forbids_dev_auth_bypass(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    with pytest.raises(ValueError, match="DEV_AUTH_ENABLED cannot be enabled"):
        Settings(_env_file=None, dev_auth_enabled=True)


def test_rate_limiting_is_user_scoped(auth_app, monkeypatch):
    users = {
        "token-user-a": {"uid": "user-a"},
        "token-user-b": {"uid": "user-b"},
    }
    verify = Mock(side_effect=lambda token, **kwargs: users[token])
    monkeypatch.setattr(auth, "verify_id_token", verify)
    auth_app.state.identity.app = Mock()

    with TestClient(auth_app, raise_server_exceptions=False) as client:
        # Exhaust user-a's limit of 3 requests
        for i in range(3):
            res = client.post(
                "/api/connection-test",
                headers={"Authorization": "Bearer token-user-a"},
                json={"requestId": f"r-a-{i}", "idea": "idea a"},
            )
            assert res.status_code == 200

        # 4th request from user-a is rate limited
        res = client.post(
            "/api/connection-test",
            headers={"Authorization": "Bearer token-user-a"},
            json={"requestId": "r-a-4", "idea": "idea a"},
        )
        assert res.status_code == 429

        # user-b is NOT rate limited
        res = client.post(
            "/api/connection-test",
            headers={"Authorization": "Bearer token-user-b"},
            json={"requestId": "r-b-1", "idea": "idea b"},
        )
        assert res.status_code == 200
