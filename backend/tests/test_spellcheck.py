import json
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app
from app.schemas.spellcheck import SpellcheckIssue, SpellcheckReviewRequest
from app.services.mock_ai import MockAakaroAI
from app.services.spellcheck import find_deterministic_issues
from test_brand_kit import kit_input
from test_services import service

OFFBRAND = (
    "Our revolutionary platform helps students build teams. "
    "It is a game-changing tool for finding the right people."
)
CLEAN = (
    "Meet Teamly, a friendly way for campus builders to find teammates, "
    "compare skills, and ship projects together this semester."
)


def review_request(kit, content, **overrides):
    body = {
        "requestId": "spell-test",
        "brandKit": kit.model_dump(),
        "content": content,
    }
    body.update(overrides)
    return SpellcheckReviewRequest.model_validate(body)


async def test_mock_review_uses_submitted_kit_and_content(kit_input):
    monkey_kit = kit_input[1]
    provider = MockAakaroAI()
    offbrand = await provider.spellcheck_review(monkey_kit, OFFBRAND, [])
    clean = await provider.spellcheck_review(monkey_kit, CLEAN, [])
    # The off-brand content triggers issues tied to the actual kit rules.
    assert offbrand.issues, "expected avoided-language findings"
    rule_ids = {rule.id for rule in monkey_kit.rules}
    assert all(issue.ruleId in rule_ids for issue in offbrand.issues)
    assert all(issue.originalText.casefold() in OFFBRAND.casefold() for issue in offbrand.issues)
    # Compliant content yields an honest empty result with all rules passing.
    assert clean.issues == []
    assert clean.passedRuleIds == [rule.id for rule in monkey_kit.rules]


async def test_deterministic_finder_matches_whole_words(kit_input):
    _, kit = kit_input
    issues = find_deterministic_issues(kit, OFFBRAND)
    assert {issue.originalText.casefold() for issue in issues} == {
        "revolutionary",
        "game-changing",
    }
    for issue in issues:
        assert OFFBRAND[issue.start : issue.end] == issue.originalText
    # 'revolutionaries' must not match 'revolutionary'; unknown words never match.
    assert find_deterministic_issues(kit, "The revolutionaries kept their notes.") == []
    # A repeated phrase stays one issue, with the count in the explanation.
    repeated = find_deterministic_issues(kit, "Revolutionary idea. Truly revolutionary results.")
    assert len(repeated) == 1
    assert "2 times" in repeated[0].explanation


async def test_endpoint_contract_and_mock_determinism(kit_input, monkeypatch):
    monkeypatch.setattr(MockAakaroAI, "_delay", AsyncMock())
    request, _kit = kit_input
    body = review_request(request.brandKit if hasattr(request, "brandKit") else _kit, OFFBRAND)
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True, mock_provider_enabled=True))
    with TestClient(app) as client:
        first = client.post("/api/spellcheck/review", json=body.model_dump())
        second = client.post("/api/spellcheck/review", json=body.model_dump())
    assert first.status_code == 200
    assert second.status_code == 200
    first_data = dict(first.json()["data"])
    second_data = dict(second.json()["data"])
    # reviewedAt stamps each call; everything else must be deterministic.
    first_data.pop("reviewedAt")
    second_data.pop("reviewedAt")
    assert first_data == second_data
    review = first.json()["data"]
    assert review["aiReviewed"] is True
    assert review["reviewedAt"]
    rule_ids = {rule["id"] for rule in body.brandKit.model_dump()["rules"]}
    assert review["issues"] and all(issue["ruleId"] in rule_ids for issue in review["issues"])
    # AI duplicates of rule-based findings keep the applyable replacement.
    replacements = [issue["replacement"] for issue in review["issues"]]
    assert any(replacement for replacement in replacements)
    for issue in review["issues"]:
        assert body.content[issue["start"] : issue["end"]] == issue["originalText"]
    failed = {issue["ruleId"] for issue in review["issues"]}
    assert all(rule_id not in failed for rule_id in review["passedRuleIds"])


async def test_zero_issue_response_allowed(kit_input, monkeypatch):
    monkeypatch.setattr(MockAakaroAI, "_delay", AsyncMock())
    _, kit = kit_input
    body = review_request(kit, CLEAN)
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True, mock_provider_enabled=True))
    with TestClient(app) as client:
        response = client.post("/api/spellcheck/review", json=body.model_dump())
    assert response.status_code == 200
    review = response.json()["data"]
    assert review["issues"] == []
    assert review["passedRuleIds"] == [rule.id for rule in kit.rules]


async def test_requires_identity(kit_input):
    _, kit = kit_input
    body = review_request(kit, CLEAN)
    with TestClient(create_app(Settings(_env_file=None))) as client:
        response = client.post("/api/spellcheck/review", json=body.model_dump())
    assert response.status_code == 401


@pytest.mark.parametrize(
    "defect",
    ["blank", "too-long", "missing-kit", "extra-field", "ai-source-client-issue"],
)
async def test_invalid_request_rejected(kit_input, defect):
    _, kit = kit_input
    body = review_request(kit, CLEAN).model_dump()
    if defect == "blank":
        body["content"] = "   "
    elif defect == "too-long":
        body["content"] = "x" * 8001
    elif defect == "missing-kit":
        del body["brandKit"]
    elif defect == "extra-field":
        body["draft"] = True
    else:
        body["deterministicIssues"] = [
            {
                "id": "",
                "source": "ai",
                "ruleId": "rule1",
                "severity": "low",
                "category": "voice",
                "originalText": CLEAN[:10],
                "explanation": "x",
                "suggestion": "y",
            }
        ]
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True))
    with TestClient(app) as client:
        response = client.post("/api/spellcheck/review", json=body)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_client_deterministic_issues_merged(kit_input, monkeypatch):
    monkeypatch.setattr(MockAakaroAI, "_delay", AsyncMock())
    _, kit = kit_input
    client_issue = {
        "id": "",
        "source": "deterministic",
        "ruleId": kit.rules[0].id,
        "severity": "low",
        "category": "voice",
        "originalText": "Teamly",
        "explanation": "Client-side finding for the test.",
        "suggestion": "Consider the confirmed voice.",
    }
    body = review_request(
        kit, CLEAN, deterministicIssues=[client_issue]
    )
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True, mock_provider_enabled=True))
    with TestClient(app) as client:
        response = client.post("/api/spellcheck/review", json=body.model_dump())
    assert response.status_code == 200
    issues = response.json()["data"]["issues"]
    assert any(
        issue["source"] == "deterministic"
        and issue["ruleId"] == kit.rules[0].id
        and issue["originalText"] == "Teamly"
        for issue in issues
    )


async def test_client_issue_with_unknown_rule_dropped(kit_input, monkeypatch):
    monkeypatch.setattr(MockAakaroAI, "_delay", AsyncMock())
    _, kit = kit_input
    body = review_request(
        kit,
        CLEAN,
        deterministicIssues=[
            {
                "id": "",
                "source": "deterministic",
                "ruleId": "rule99",
                "severity": "low",
                "category": "voice",
                "originalText": "Teamly",
                "explanation": "Hallucinated rule.",
                "suggestion": "n/a",
            }
        ],
    )
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True, mock_provider_enabled=True))
    with TestClient(app) as client:
        response = client.post("/api/spellcheck/review", json=body.model_dump())
    assert response.status_code == 200
    assert response.json()["data"]["issues"] == []


async def test_ai_failure_degrades_to_rule_checks(kit_input):
    _, kit = kit_input
    body = review_request(kit, OFFBRAND)
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True))
    app.state.gemini = SimpleNamespace(
        spellcheck_review=AsyncMock(
            side_effect=AppError(502, "PROVIDER_UNAVAILABLE", "down", True)
        ),
        close=AsyncMock(),
    )
    with TestClient(app) as client:
        response = client.post("/api/spellcheck/review", json=body.model_dump())
    assert response.status_code == 200
    review = response.json()["data"]
    assert review["aiReviewed"] is False
    assert review["issues"]
    assert all(issue["source"] == "deterministic" for issue in review["issues"])
    assert "unavailable" in review["summary"]
    assert review["passedRuleIds"] == []


async def test_non_degradable_provider_error_propagates(kit_input):
    _, kit = kit_input
    body = review_request(kit, OFFBRAND)
    app = create_app(Settings(_env_file=None, dev_auth_enabled=True))
    app.state.gemini = SimpleNamespace(
        spellcheck_review=AsyncMock(
            side_effect=AppError(500, "INTERNAL_ERROR", "unexpected", True)
        ),
        close=AsyncMock(),
    )
    with TestClient(app) as client:
        response = client.post("/api/spellcheck/review", json=body.model_dump())
    assert response.status_code == 500


PROVIDER_BAD_RULE = json.dumps(
    {
        "summary": "Two phrases conflict with the grounded language rule.",
        "issues": [
            {
                "ruleId": "tone-rule",
                "severity": "medium",
                "category": "language",
                "originalText": "Our revolutionary platform",
                "explanation": "Inflated claim.",
                "suggestion": "Use concrete language.",
                "replacement": "Our platform helps student builders",
            }
        ],
        "passedRuleIds": [],
    }
)

PROVIDER_BAD_QUOTE = json.dumps(
    {
        "summary": "One phrase conflicts.",
        "issues": [
            {
                "ruleId": "rule3",
                "severity": "medium",
                "category": "language",
                "originalText": "not in the content at all",
                "explanation": "Inflated claim.",
                "suggestion": "Use concrete language.",
            }
        ],
        "passedRuleIds": [],
    }
)

PROVIDER_GOOD = json.dumps(
    {
        "summary": "Two phrases conflict with the grounded language rule.",
        "issues": [
            {
                "ruleId": "rule3",
                "severity": "high",
                "category": "language",
                "originalText": "revolutionary",
                "explanation": "The confirmed brand system avoids inflated product claims.",
                "suggestion": "Use concrete language focused on outcomes.",
                "replacement": "new",
            }
        ],
        "passedRuleIds": ["rule1", "rule2", "rule4", "rule5", "rule6", "rule7", "rule8"],
    }
)


async def test_unknown_rule_id_repairs_then_fails(kit_input):
    _, kit = kit_input
    provider, generate = service(
        [SimpleNamespace(text=PROVIDER_BAD_RULE), SimpleNamespace(text=PROVIDER_BAD_RULE)]
    )
    with pytest.raises(AppError) as error:
        await provider.spellcheck_review(kit, OFFBRAND, [])
    assert error.value.code == "INVALID_AI_RESPONSE" and generate.await_count == 2


async def test_ungrounded_quote_repairs_once(kit_input):
    _, kit = kit_input
    provider, generate = service(
        [SimpleNamespace(text=PROVIDER_BAD_QUOTE), SimpleNamespace(text=PROVIDER_GOOD)]
    )
    result = await provider.spellcheck_review(kit, OFFBRAND, [])
    assert result.issues[0].ruleId == "rule3"
    assert generate.await_count == 2
    assert "issue quotes" in generate.call_args.kwargs["config"].system_instruction


def test_issue_schema_rejects_bad_severity_and_offsets():
    base = {
        "source": "ai",
        "ruleId": "rule1",
        "category": "voice",
        "originalText": "quote",
        "explanation": "why",
        "suggestion": "how",
    }
    with pytest.raises(ValidationError):
        SpellcheckIssue(**base, severity="urgent")
    with pytest.raises(ValidationError):
        SpellcheckIssue(**base, severity="low", start=5)
    with pytest.raises(ValidationError):
        SpellcheckIssue(**base, severity="low", start=5, end=5)
    ok = SpellcheckIssue(**base, severity="low", start=0, end=5)
    assert ok.replacement is None
