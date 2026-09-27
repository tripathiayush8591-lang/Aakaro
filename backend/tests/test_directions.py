import json
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app
from app.schemas.stages import DirectionsGenerateRequest, DirectionsResult
from app.services.mock_ai import MockAakaroAI
from test_naming import BRIEF, CANDIDATES, EVALUATIONS
from test_services import service

BODY = {"requestId": "directions-test", "strategy": BRIEF,
        "shortlistedCandidates": CANDIDATES[:2], "evaluations": EVALUATIONS[:2]}


@pytest.fixture
async def result(monkeypatch):
    monkeypatch.setattr(MockAakaroAI, "_delay", AsyncMock())
    body = DirectionsGenerateRequest.model_validate(BODY)
    return await MockAakaroAI().directions(body.strategy, body.shortlistedCandidates, body.evaluations)


@pytest.mark.parametrize("count", [0, 1, 3, 5])
def test_requires_two_shortlisted_candidates(count):
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True))
    with TestClient(app) as client:
        response = client.post("/api/directions/generate", json={**BODY, "shortlistedCandidates": CANDIDATES[:count]})
    assert response.status_code == 422


def test_requires_matching_evaluations():
    with pytest.raises(ValidationError):
        DirectionsGenerateRequest.model_validate({**BODY, "evaluations": EVALUATIONS[1:3]})


async def test_endpoint_two_canonical_directions_and_mock_deterministic(result):
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True, mock_provider_enabled=True))
    with TestClient(app) as client:
        first = client.post("/api/directions/generate", json=BODY)
        second = client.post("/api/directions/generate", json=BODY)
    assert first.status_code == 200
    assert first.json() == second.json()
    directions = first.json()["data"]["directions"]
    assert len(directions) == 2
    assert [d["id"] for d in directions] == ["direction1", "direction2"]
    assert [d["candidateId"] for d in directions] == ["n1", "n2"]
    assert directions[0]["colors"] != directions[1]["colors"]
    assert directions[0]["typography"] != directions[1]["typography"]


@pytest.mark.parametrize("defect", ["count", "id", "duplicate", "hex"])
async def test_invalid_output_rejected(result, defect):
    data = deepcopy(result.model_dump())
    if defect == "count":
        data["directions"].pop()
    elif defect == "id":
        data["directions"][0]["id"] = "d1"
    elif defect == "duplicate":
        data["directions"][1]["candidateId"] = "n1"
    else:
        data["directions"][0]["colors"]["primary"] = "red"
    with pytest.raises(ValidationError):
        DirectionsResult.model_validate(data)


@pytest.mark.parametrize("bad", ["{}", "not-json", "mapping", "hex"])
async def test_provider_repairs_once_then_safe_failure(result, bad):
    body = DirectionsGenerateRequest.model_validate(BODY)
    if bad in {"mapping", "hex"}:
        data = result.model_dump()
        if bad == "mapping":
            data["directions"][1]["candidateId"] = "n5"
        else:
            data["directions"][0]["colors"]["accent"] = "#ZZZZZZ"
        bad = json.dumps(data)
    value, generate = service([SimpleNamespace(text=bad)] * 2)
    with pytest.raises(AppError) as error:
        await value.directions(body.strategy, body.shortlistedCandidates, body.evaluations)
    assert error.value.code == "INVALID_AI_RESPONSE"
    assert generate.await_count == 2


async def test_provider_repair_and_shortlist_only_payload(result):
    body = DirectionsGenerateRequest.model_validate(BODY)
    value, generate = service([SimpleNamespace(text="{}"), SimpleNamespace(text=result.model_dump_json())])
    output = await value.directions(body.strategy, body.shortlistedCandidates, body.evaluations)
    assert output == result
    assert generate.await_count == 2
    sent = json.loads(generate.call_args.kwargs["contents"])
    assert set(sent) == {"strategy", "shortlistedCandidates", "evaluations"}
    assert [c["id"] for c in sent["shortlistedCandidates"]] == ["n1", "n2"]


def test_directions_requires_identity():
    app = create_app(Settings(_env_file=None))
    with TestClient(app) as client:
        assert client.post("/api/directions/generate", json=BODY).status_code == 401
