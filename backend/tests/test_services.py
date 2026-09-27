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


CLARIFY_JSON = (
    '{"questions":['
    '{"id":"weird","question":"Q1?","reason":"R1."},'
    '{"id":"q2","question":"Q2?","reason":"R2."},'
    '{"id":"q9","question":"Q3?","reason":"R3."}]}'
)
STRATEGY_JSON = (
    '{"oneLiner":"One line.","audience":{"primary":"Students","description":"Campus builders."},'
    '"problem":"Hard to find people.","promise":"Simple matching.","differentiation":"Intent first.",'
    '"personality":["Warm","Focused","Honest"],"positioning":"The calm alternative.",'
    '"namingTerritories":["Coined & Warm","Plain Spoken"]}'
)


async def test_clarify_repairs_then_normalizes_ids():
    value, generate = service(
        [SimpleNamespace(text="{}"), SimpleNamespace(text=CLARIFY_JSON)]
    )
    result = await value.clarify("idea")
    assert [q.id for q in result.questions] == ["q1", "q2", "q3"]
    assert generate.await_count == 2


async def test_clarify_invalid_output_stops_after_two():
    value, generate = service([SimpleNamespace(text="{}"), SimpleNamespace(text="{}")])
    with pytest.raises(AppError) as error:
        await value.clarify("idea")
    assert error.value.code == "INVALID_AI_RESPONSE" and generate.await_count == 2


async def test_strategy_sends_pairs_as_data():
    import json

    value, generate = service([SimpleNamespace(text=STRATEGY_JSON)])
    from app.schemas.stages import ClarificationPair

    brief = await value.strategy(
        "idea",
        [ClarificationPair(question="Q?", answer="A") for _ in range(3)],
    )
    assert brief.oneLiner == "One line."
    payload = json.loads(generate.call_args.kwargs["contents"])
    assert payload["clarifications"] == [{"question": "Q?", "answer": "A"}] * 3


def brief_model():
    from app.schemas.stages import StrategyBrief

    return StrategyBrief(
        oneLiner="One line.",
        audience={"primary": "Students", "description": "Campus builders."},
        problem="Hard to find people.",
        promise="Simple matching.",
        differentiation="Intent first.",
        personality=["Warm", "Focused", "Honest"],
        positioning="The calm alternative.",
        namingTerritories=["Coined & Warm", "Plain Spoken"],
    )


def candidate_models():
    from app.schemas.stages import NamingCandidate

    return [
        NamingCandidate(
            id=f"n{index}",
            name=name,
            rationale=f"Reason {index}.",
            territory="Coined & Warm",
        )
        for index, name in enumerate(
            ["Nomira", "Plainly", "Warmhold", "Spoken", "Candid"], start=1
        )
    ]


NAMING_JSON = (
    '{"candidates":['
    '{"id":"any","name":"Nomira","rationale":"Coined from warmth.","territory":"Coined & Warm"},'
    '{"id":"x2","name":"Plainly","rationale":"Direct.","territory":"Plain Spoken"},'
    '{"id":"x3","name":"Warmhold","rationale":"Warm.","territory":"Coined & Warm"},'
    '{"id":"x4","name":"Spoken","rationale":"Spoken.","territory":"Plain Spoken"},'
    '{"id":"x5","name":"Candid","rationale":"Candid.","territory":"Plain Spoken"}]}'
)

EVALUATION_JSON = (
    '{"evaluations":['
    + ",".join(
        f'{{"candidateId":"n{n}","scores":{{"distinctiveness":{n},"strategicFit":4,'
        f'"memorability":3,"extensibility":2}},"strengths":["Short."],'
        f'"risks":["Could blend in."],"verdict":"Trade-off {n}."}}'
        for n in range(1, 6)
    )
    + "]}"
)


async def test_naming_candidates_repairs_then_normalizes_ids():
    value, generate = service(
        [SimpleNamespace(text="{}"), SimpleNamespace(text=NAMING_JSON)]
    )
    result = await value.naming_candidates(brief_model())
    assert [c.id for c in result.candidates] == ["n1", "n2", "n3", "n4", "n5"]
    assert generate.await_count == 2


async def test_naming_duplicate_names_repair_once_then_fail():
    duplicate = NAMING_JSON.replace('"Plainly"', '"nomira"', 1)
    value, generate = service(
        [SimpleNamespace(text=duplicate), SimpleNamespace(text=duplicate)]
    )
    with pytest.raises(AppError) as error:
        await value.naming_candidates(brief_model())
    assert error.value.code == "INVALID_AI_RESPONSE" and generate.await_count == 2


async def test_naming_evaluation_repairs_missing_candidate_ids():
    missing = EVALUATION_JSON.replace(
        '"candidateId":"n5"', '"candidateId":"n9"'
    )
    value, generate = service(
        [SimpleNamespace(text=missing), SimpleNamespace(text=EVALUATION_JSON)]
    )
    result = await value.naming_evaluation(brief_model(), candidate_models())
    assert [e.candidateId for e in result.evaluations] == [
        "n1",
        "n2",
        "n3",
        "n4",
        "n5",
    ]
    assert generate.await_count == 2
    assert "candidate IDs" in generate.call_args.kwargs["config"].system_instruction


async def test_naming_evaluation_mismatch_stops_after_two():
    value, generate = service(
        [SimpleNamespace(text=EVALUATION_JSON), SimpleNamespace(text=EVALUATION_JSON)]
    )
    # Submitted candidates use different ids than the evaluation references.
    renamed = [
        c.model_copy(update={"id": f"other-{index}"})
        for index, c in enumerate(candidate_models(), start=1)
    ]
    with pytest.raises(AppError) as error:
        await value.naming_evaluation(brief_model(), renamed)
    assert error.value.code == "INVALID_AI_RESPONSE" and generate.await_count == 2
