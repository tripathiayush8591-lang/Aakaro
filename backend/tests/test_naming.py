"""Naming endpoints (candidates + evaluation) and the mock naming fixtures."""

import asyncio
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app
from app.schemas.stages import (
    NamingCandidate,
    NamingCandidatesResult,
    NamingEvaluation,
    NamingEvaluationResult,
    StrategyBrief,
)
from app.services.auth import Identity
from app.services.mock_ai import MockAakaroAI

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

CANDIDATES = [
    {
        "id": f"n{n}",
        "name": f"Name {n}",
        "rationale": f"Because {n}.",
        "territory": "Coined & Warm",
        **({"linguisticNote": "Easy to say."} if n == 1 else {}),
    }
    for n in range(1, 6)
]

EVALUATIONS = [
    {
        "candidateId": f"n{n}",
        "scores": {
            "distinctiveness": 4,
            "strategicFit": 3,
            "memorability": 5,
            "extensibility": 2,
        },
        "strengths": ["Short.", "Concrete."],
        "risks": ["Could blend in."],
        "verdict": f"Trade-off {n}.",
    }
    for n in range(1, 6)
]


@pytest.fixture
def setup():
    app = create_app(Settings(_env_file=None, user_request_limit=3))
    app.state.identity = Mock(verify=Mock(return_value=Identity("verified-user")))
    app.state.gemini = Mock(
        naming_candidates=AsyncMock(
            return_value=NamingCandidatesResult(
                candidates=[NamingCandidate(**c) for c in CANDIDATES]
            )
        ),
        naming_evaluation=AsyncMock(
            return_value=NamingEvaluationResult(
                evaluations=[NamingEvaluation(**e) for e in EVALUATIONS]
            )
        ),
        close=AsyncMock(),
    )
    with TestClient(app, raise_server_exceptions=False) as client:
        yield app, client


def auth(**kwargs):
    return {"Authorization": "Bearer valid", **kwargs}


def test_naming_candidates_returns_five_canonical_ids(setup):
    app, client = setup
    response = client.post(
        "/api/naming/candidates", headers=auth(), json={"requestId": "r", "strategy": BRIEF}
    )
    assert response.status_code == 200
    candidates = response.json()["data"]["candidates"]
    assert [c["id"] for c in candidates] == ["n1", "n2", "n3", "n4", "n5"]
    sent = app.state.gemini.naming_candidates.await_args.args[0]
    assert sent.oneLiner == BRIEF["oneLiner"]


def test_naming_candidates_requires_auth(setup):
    _app, client = setup
    response = client.post(
        "/api/naming/candidates", json={"requestId": "r", "strategy": BRIEF}
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_REQUIRED"


@pytest.mark.parametrize(
    "body",
    [
        {"requestId": "r"},
        {"requestId": "r", "strategy": {**BRIEF, "personality": ["one"]}},
        {"requestId": "r", "strategy": BRIEF, "uid": "attacker"},
        {"strategy": BRIEF},
    ],
)
def test_naming_candidates_validation_rejects_bad_input(setup, body):
    app, client = setup
    response = client.post("/api/naming/candidates", headers=auth(), json=body)
    assert response.status_code == 422
    app.state.gemini.naming_candidates.assert_not_called()


def test_naming_candidates_provider_failure_is_safe(setup):
    app, client = setup
    app.state.gemini.naming_candidates.side_effect = AppError(
        502, "INVALID_AI_RESPONSE", "AI returned an incomplete response. Try again.", True
    )
    response = client.post(
        "/api/naming/candidates", headers=auth(), json={"requestId": "r", "strategy": BRIEF}
    )
    assert response.status_code == 502
    assert response.json()["error"]["retryable"] is True


def test_naming_evaluate_passes_candidates_through(setup):
    app, client = setup
    response = client.post(
        "/api/naming/evaluate",
        headers=auth(),
        json={"requestId": "r", "strategy": BRIEF, "candidates": CANDIDATES},
    )
    assert response.status_code == 200
    evaluations = response.json()["data"]["evaluations"]
    assert [e["candidateId"] for e in evaluations] == ["n1", "n2", "n3", "n4", "n5"]
    sent = app.state.gemini.naming_evaluation.await_args.args
    assert [c.id for c in sent[1]] == ["n1", "n2", "n3", "n4", "n5"]


@pytest.mark.parametrize(
    "candidates",
    [
        CANDIDATES[:4],
        [CANDIDATES[0]] * 5,
        [{**c, "name": "Same"} for c in CANDIDATES],
        [{**c, "id": "n1", "name": f"N{n}"} for n, c in enumerate(CANDIDATES)],
        [{**c, "scores": 1} for c in CANDIDATES],
    ],
)
def test_naming_evaluate_validation_rejects_bad_candidates(setup, candidates):
    app, client = setup
    response = client.post(
        "/api/naming/evaluate",
        headers=auth(),
        json={"requestId": "r", "strategy": BRIEF, "candidates": candidates},
    )
    assert response.status_code == 422
    app.state.gemini.naming_evaluation.assert_not_called()


def test_naming_evaluate_provider_failure_is_safe(setup):
    app, client = setup
    app.state.gemini.naming_evaluation.side_effect = AppError(
        504, "PROVIDER_TIMEOUT", "AI took too long. Please try again.", True
    )
    response = client.post(
        "/api/naming/evaluate",
        headers=auth(),
        json={"requestId": "r", "strategy": BRIEF, "candidates": CANDIDATES},
    )
    assert response.status_code == 504


def test_mock_naming_fixtures_are_deterministic_and_cover_the_five_ids():
    provider = MockAakaroAI()
    brief = StrategyBrief(**BRIEF)
    first = asyncio.run(provider.naming_candidates(brief))
    second = asyncio.run(provider.naming_candidates(brief))
    assert first == second
    ids = [c.id for c in first.candidates]
    names = [c.name for c in first.candidates]
    assert ids == ["n1", "n2", "n3", "n4", "n5"]
    assert len(set(names)) == 5 and len(set(n.casefold() for n in names)) == 5
    evaluation = asyncio.run(provider.naming_evaluation(brief, first.candidates))
    assert [e.candidateId for e in evaluation.evaluations] == ids
    assert all(
        1 <= v <= 5
        for e in evaluation.evaluations
        for v in e.scores.model_dump().values()
    )


def test_mock_naming_evaluation_respects_verdict_limit_for_long_strategy():
    provider = MockAakaroAI()
    brief = StrategyBrief.model_validate(
        {
            **BRIEF,
            "audience": {
                "primary": "First-time participants who want a welcoming, skill-balanced team.",
                "description": "From your answers: First-time participants who want a welcoming, skill-balanced team.",
            },
            "promise": "Deliver clearly on what you described: A platform that helps college students find compatible teammates for hackathons based on skills, interests and project goals.",
            "differentiation": "From your answers: Collaborative and welcoming, with enough energy for a live hackathon.",
        }
    )
    candidates = asyncio.run(provider.naming_candidates(brief)).candidates
    evaluation = asyncio.run(provider.naming_evaluation(brief, candidates))
    assert all(len(item.verdict) <= 300 for item in evaluation.evaluations)
