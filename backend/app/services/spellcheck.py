"""Deterministic rule checks and grounded review assembly for Brand Spellcheck.

Only the confirmed kit supplied with the request is used — no invented rules.
Deterministic findings come from (a) phrases a language rule names explicitly in
quotes and (b) concrete tokens of the voice's avoided language. Everything else
is left to the AI review.
"""

import re

from app.schemas.brand_kit import BrandKit
from app.schemas.spellcheck import (
    SpellcheckIssue,
    SpellcheckReview,
    SpellcheckReviewResult,
)

_MAX_DETERMINISTIC_ISSUES = 8
_MAX_MERGED_ISSUES = 12
_TOKEN_SPLIT = re.compile(r"\s*(?:,|/|;|\bor\b|\band\b)\s*", re.IGNORECASE)
_QUOTED_PHRASE = re.compile(r"'([^']{3,80})'")


def _clip(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _fallback_rule_id(kit: BrandKit) -> str | None:
    for category in ("language", "voice", "messaging", "visual"):
        for rule in kit.rules:
            if rule.category == category:
                return rule.id
    return None


def banned_phrases(kit: BrandKit) -> list[tuple[str, str, str]]:
    """(phrase, ruleId, severity) pairs derived only from the supplied kit."""
    fallback = _fallback_rule_id(kit)
    phrases: dict[str, tuple[str, str, str]] = {}
    # A language rule that names a phrase in quotes checks that phrase verbatim.
    for rule in kit.rules:
        if rule.category != "language":
            continue
        for quote in _QUOTED_PHRASE.findall(rule.rule):
            phrase = quote.strip()
            if len(phrase) >= 3 and phrase.casefold() not in phrases:
                phrases[phrase.casefold()] = (phrase, rule.id, "high")
    # Avoided-voice patterns are split into their concrete tokens.
    if fallback:
        for entry in kit.voice.avoidedLanguage:
            for token in _TOKEN_SPLIT.split(entry):
                token = token.strip().strip(".'\"")
                if len(token) >= 3 and token.casefold() not in phrases:
                    phrases[token.casefold()] = (token, fallback, "medium")
    return list(phrases.values())


def _occurrences(content: str, phrase: str) -> list[tuple[int, int]]:
    pattern = r"(?<!\w)" + re.escape(phrase) + r"(?!\w)"
    return [
        (match.start(), match.end())
        for match in re.finditer(pattern, content, re.IGNORECASE)
    ]


def find_deterministic_issues(kit: BrandKit, content: str) -> list[SpellcheckIssue]:
    rules = {rule.id: rule for rule in kit.rules}
    issues: list[SpellcheckIssue] = []
    for phrase, rule_id, severity in banned_phrases(kit):
        found = _occurrences(content, phrase)
        if not found:
            continue
        start, end = found[0]
        repeated = (
            f" It appears {len(found)} times in the content." if len(found) > 1 else ""
        )
        issues.append(
            SpellcheckIssue(
                id=f"d{len(issues) + 1}",
                source="deterministic",
                ruleId=rule_id,
                severity=severity,
                category="language",
                originalText=content[start:end],
                start=start,
                end=end,
                explanation=_clip(
                    f"'{content[start:end]}' conflicts with {rule_id}: "
                    f"\"{rules[rule_id].rule}\".{repeated}",
                    400,
                ),
                suggestion=(
                    "Rewrite this phrase in plain wording that fits the confirmed voice."
                ),
            )
        )
        if len(issues) >= _MAX_DETERMINISTIC_ISSUES:
            break
    return issues


def build_review(
    kit: BrandKit,
    content: str,
    result: SpellcheckReviewResult,
    deterministic: list[SpellcheckIssue],
    client_issues: list[SpellcheckIssue],
) -> SpellcheckReview:
    """Ground and merge provider issues with rule-based findings.

    Quotes are canonicalized against the actual content (so apply-fix always
    matches), ids are reassigned in merged order, and duplicates collapse to the
    first finding. AI findings come first: they carry applyable replacements for
    violations the rule-based pass also caught; if the AI fails entirely the
    route still returns the rule-based findings via `degraded_review`.
    """
    valid = {rule.id for rule in kit.rules}
    lowered = content.casefold()

    def grounded(issue: SpellcheckIssue) -> SpellcheckIssue | None:
        if issue.ruleId not in valid:
            return None
        index = lowered.find(issue.originalText.casefold())
        if index < 0:
            return None
        end = index + len(issue.originalText)
        return issue.model_copy(
            update={"originalText": content[index:end], "start": index, "end": end}
        )

    merged: list[SpellcheckIssue] = []
    seen: set[tuple[str, str]] = set()

    def add(issue: SpellcheckIssue | None) -> None:
        if issue is None or len(merged) >= _MAX_MERGED_ISSUES:
            return
        key = (issue.ruleId, issue.originalText.casefold())
        if key in seen:
            return
        seen.add(key)
        merged.append(issue.model_copy(update={"id": f"i{len(merged) + 1}"}))

    for issue in result.issues:
        add(
            grounded(
                SpellcheckIssue(
                    id="",
                    source="ai",
                    ruleId=issue.ruleId,
                    severity=issue.severity,
                    category=issue.category,
                    originalText=issue.originalText,
                    explanation=issue.explanation,
                    suggestion=issue.suggestion,
                    replacement=issue.replacement,
                )
            )
        )
    for issue in deterministic:
        add(grounded(issue))
    for issue in client_issues:
        add(grounded(issue))

    failed = {issue.ruleId for issue in merged}
    provider_passed = set(result.passedRuleIds)
    passed = [
        rule.id
        for rule in kit.rules
        if rule.id in provider_passed and rule.id not in failed
    ]
    return SpellcheckReview(
        summary=result.summary,
        issues=merged,
        passedRuleIds=passed,
        aiReviewed=True,
        reviewedAt="",
    )


def degraded_review(deterministic: list[SpellcheckIssue]) -> SpellcheckReview:
    """Honest partial result when the AI review is unavailable."""
    if deterministic:
        summary = (
            f"Rule-based checks found {len(deterministic)} issue(s). "
            "AI review is unavailable right now, so tone and context were not checked."
        )
    else:
        summary = (
            "Rule-based checks found no banned-phrase violations. "
            "AI review is unavailable right now, so tone and context were not checked."
        )
    return SpellcheckReview(
        summary=summary,
        issues=deterministic,
        passedRuleIds=[],
        aiReviewed=False,
        reviewedAt="",
    )
