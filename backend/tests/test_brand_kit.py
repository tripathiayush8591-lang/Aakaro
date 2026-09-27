import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.main import create_app
from app.schemas.brand_kit import BrandKit, BrandKitGenerateRequest
from app.schemas.stages import DirectionsGenerateRequest
from app.services.mock_ai import MockAakaroAI
from test_directions import BODY
from test_services import service


@pytest.fixture
async def kit_input(monkeypatch):
    monkeypatch.setattr(MockAakaroAI, "_delay", AsyncMock())
    body = DirectionsGenerateRequest.model_validate(BODY)
    provider = MockAakaroAI()
    directions = await provider.directions(body.strategy, body.shortlistedCandidates, body.evaluations)
    request = BrandKitGenerateRequest(requestId="kit-test", strategy=body.strategy,
                                     selectedCandidate=body.shortlistedCandidates[0],
                                     selectedDirection=directions.directions[0])
    kit = await provider.brand_kit(request.strategy, request.selectedCandidate, request.selectedDirection)
    return request, kit


async def test_endpoint_contract_and_mock_determinism(kit_input):
    request, kit = kit_input
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True, mock_provider_enabled=True))
    with TestClient(app) as client:
        first = client.post("/api/brand-kit/generate", json=request.model_dump())
        second = client.post("/api/brand-kit/generate", json=request.model_dump())
    assert first.status_code == 200
    assert first.json() == second.json()
    assert first.json()["data"] == kit.model_dump()
    assert kit.identity.name == request.selectedCandidate.name
    assert kit.colors.model_dump() == request.selectedDirection.colors.model_dump(exclude={"rationale"})
    assert 6 <= len(kit.rules) <= 10
    assert [r.id for r in kit.rules] == [f"rule{i}" for i in range(1, len(kit.rules) + 1)]


@pytest.mark.parametrize("defect", ["missing", "mismatch", "hex", "extra"])
async def test_invalid_request_rejected(kit_input, defect):
    request, _ = kit_input
    body = request.model_dump()
    if defect == "missing":
        del body["selectedDirection"]
    elif defect == "mismatch":
        body["selectedCandidate"]["id"] = "n5"
    elif defect == "hex":
        body["selectedDirection"]["colors"]["primary"] = "red"
    else:
        body["draft"] = True
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True))
    with TestClient(app) as client:
        response = client.post("/api/brand-kit/generate", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_requires_identity(kit_input):
    request, _ = kit_input
    with TestClient(create_app(Settings(_env_file=None))) as client:
        assert client.post("/api/brand-kit/generate", json=request.model_dump()).status_code == 401


@pytest.mark.parametrize("defect", ["hex", "few", "many", "empty"])
async def test_output_validation(kit_input, defect):
    _, kit = kit_input
    data = kit.model_dump()
    if defect == "hex":
        data["colors"]["primary"] = "#ABC"
    elif defect == "few":
        data["rules"] = data["rules"][:5]
    elif defect == "many":
        data["rules"] *= 2
    else:
        data["voice"]["description"] = " "
    with pytest.raises(ValidationError):
        BrandKit.model_validate(data)


async def test_repairs_and_canonicalizes_untrusted_ids(kit_input):
    request, kit = kit_input
    data = kit.model_dump()
    for r in data["rules"]:
        r["id"] = "provider-id"
    provider, generate = service([SimpleNamespace(text="not-json"), SimpleNamespace(text=json.dumps(data))])
    output = await provider.brand_kit(request.strategy, request.selectedCandidate, request.selectedDirection)
    assert output == kit
    assert generate.await_count == 2
    assert json.loads(generate.call_args.kwargs["contents"])["selectedDirection"] == request.selectedDirection.model_dump()


@pytest.mark.parametrize("defect", ["malformed", "name", "palette", "rules"])
async def test_bounded_failure_safe_envelope(kit_input, defect):
    request, kit = kit_input
    data = kit.model_dump()
    if defect == "name":
        data["identity"]["name"] = "A different name"
    elif defect == "palette":
        data["colors"]["primary"] = "#123456"
    elif defect == "rules":
        data["rules"] = []
    bad = "{}" if defect == "malformed" else json.dumps(data)
    provider, generate = service([SimpleNamespace(text=bad)] * 2)
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True))
    app.state.gemini = provider
    # Test the endpoint envelope without closing the fake SDK client.
    response = TestClient(app).post("/api/brand-kit/generate", json=request.model_dump())
    assert response.status_code == 502
    assert response.json()["error"] == {"code": "INVALID_AI_RESPONSE", "message": "AI returned no usable response. Try again.", "retryable": True}
    assert generate.await_count == 2
