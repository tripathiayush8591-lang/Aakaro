"""Stage endpoints (clarify/strategy) plus the temporary development auth mode."""

from unittest.mock import AsyncMock, Mock

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app
from app.schemas.stages import ClarifyResult, StrategyBrief
from app.services.auth import Identity
from app.services.mock_ai import MockAakaroAI

# The real GeminiService normalizes ids to q1..q3 before returning (see
# test_services.py); a service mock must honor that contract.
QUESTIONS = [
    {"id": f"q{n}", "question": f"Question {n}?", "reason": "Because."}
    for n in range(1, 4)
]
BRIEF = {
    "oneLiner": "A focused brand.",
    "audience": {"primary": "Students", "description": "Campus builders."},
    "problem": "Finding people is hard.",
    "promise": "We make it simple.",
    "differentiation": "Matching on intent.",
    "personality": ["Warm", "Focused", "Honest"],
    "positioning": "The calm alternative.",
    "namingTerritories": ["Coined & Warm", "Plain Spoken"],
}


@pytest.fixture
def setup():
    app = create_app(Settings(_env_file=None, user_request_limit=3))
    app.state.identity = Mock(verify=Mock(return_value=Identity("verified-user")))
    app.state.gemini = Mock(
        clarify=AsyncMock(return_value=ClarifyResult(questions=QUESTIONS)),
        strategy=AsyncMock(return_value=StrategyBrief(**BRIEF)),
        close=AsyncMock(),
    )
    with TestClient(app, raise_server_exceptions=False) as client:
        yield app, client


def auth(**kwargs):
    return {"Authorization": "Bearer valid", **kwargs}


def test_clarify_success_returns_three_canonical_questions(setup):
    app, client = setup
    response = client.post(
        "/api/idea/clarify", headers=auth(), json={"requestId": "r", "idea": "hello"}
    )
    assert response.status_code == 200
    questions = response.json()["data"]["questions"]
    assert [q["id"] for q in questions] == ["q1", "q2", "q3"]
    app.state.gemini.clarify.assert_awaited_once_with("hello")


def test_clarify_requires_auth_by_default(setup):
    _app, client = setup
    response = client.post("/api/idea/clarify", json={"requestId": "r", "idea": "hi"})
    assert (
        response.status_code == 401
        and response.json()["error"]["code"] == "AUTH_REQUIRED"
    )


@pytest.mark.parametrize(
    "body",
    [
        {"requestId": "r", "idea": "  "},
        {"requestId": "r", "idea": "a" * 1001},
        {"requestId": "r"},
        {"idea": "hello"},
        {"requestId": "r", "idea": "hello", "uid": "attacker"},
    ],
)
def test_clarify_validation_rejects_bad_input(setup, body):
    app, client = setup
    response = client.post("/api/idea/clarify", headers=auth(), json=body)
    assert response.status_code == 422
    app.state.gemini.clarify.assert_not_called()


def test_clarify_provider_failure_is_safe_and_preserves_nothing(setup):
    app, client = setup
    app.state.gemini.clarify.side_effect = AppError(
        502, "INVALID_AI_RESPONSE", "AI returned an incomplete response. Try again.", True
    )
    response = client.post(
        "/api/idea/clarify",
        headers=auth(),
        json={"requestId": "r", "idea": "hello"},
    )
    assert response.status_code == 502
    assert response.json()["error"]["retryable"] is True


@pytest.mark.parametrize(
    "clarifications",
    [
        [],
        [{"question": "q", "answer": "a"}],
        [{"question": "q", "answer": "a"}] * 4,
        [{"question": "q", "answer": " "} for _ in range(3)],
    ],
)
def test_strategy_validation_rejects_bad_clarifications(setup, clarifications):
    app, client = setup
    response = client.post(
        "/api/strategy/generate",
        headers=auth(),
        json={"requestId": "r", "idea": "hello", "clarifications": clarifications},
    )
    assert response.status_code == 422
    app.state.gemini.strategy.assert_not_called()


def test_strategy_success_passes_pairs_through(setup):
    app, client = setup
    clarifications = [
        {"question": f"Question {n}?", "answer": f"Answer {n}"} for n in range(1, 4)
    ]
    response = client.post(
        "/api/strategy/generate",
        headers=auth(),
        json={"requestId": "r", "idea": "hello", "clarifications": clarifications},
    )
    assert response.status_code == 200
    assert response.json()["data"]["oneLiner"] == "A focused brand."
    sent = app.state.gemini.strategy.await_args.args
    assert sent[0] == "hello" and len(sent[1]) == 3


def test_dev_auth_bypass_only_when_explicitly_enabled():
    app = create_app(
        Settings(_env_file=None, dev_auth_enabled=True, mock_provider_enabled=True)
    )
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/idea/clarify", json={"requestId": "r", "idea": "hello"}
        )
        assert response.status_code == 200
        assert [q["id"] for q in response.json()["data"]["questions"]] == [
            "q1",
            "q2",
            "q3",
        ]
    strict = create_app(Settings(_env_file=None, mock_provider_enabled=True))
    with TestClient(strict, raise_server_exceptions=False) as client:
        assert (
            client.post(
                "/api/idea/clarify", json={"requestId": "r", "idea": "hello"}
            ).status_code
            == 401
        )


def test_mock_provider_deterministic_outputs():
    import asyncio

    provider = MockAakaroAI()
    first = asyncio.run(provider.clarify("A platform helping students find hackathon teammates."))
    second = asyncio.run(provider.clarify("A platform helping students find hackathon teammates."))
    assert first == second
    assert [q.id for q in first.questions] == ["q1", "q2", "q3"]
    brief = asyncio.run(
        provider.strategy(
            "A platform helping students find hackathon teammates.",
            [
                {"question": "Who?", "answer": "First-time participants"},
                {"question": "Different?", "answer": "Skill matching"},
                {"question": "Feel?", "answer": "Welcoming"},
            ],
        )
    )
    assert len(brief.personality) == 3 and len(brief.namingTerritories) >= 2
