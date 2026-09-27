import { useEffect, useRef, useState, type Dispatch } from "react";
import type { User } from "firebase/auth";
import type {
  AakaroProject,
  BrandRule,
  SpellcheckIssue,
} from "../../types/project";
import type { ProjectAction } from "../../lib/project";
import { ApiError, reviewSpellcheck } from "../../lib/api";
import {
  applyReplacement,
  CONTENT_MAX,
  downloadSpellcheckMarkdown,
} from "../../lib/spellcheck";
import { ClayModal } from "../../components/ClayModal";

const CHECK_FAILED =
  "Spellcheck couldn't finish. Your content and rules are safe — try again.";

/**
 * Brand Spellcheck: rule-linked review of pasted content. Every issue traces
 * to a confirmed brand rule, fixes move only the working copy, and nothing is
 * rewritten without the user's explicit Apply fix.
 */
export function SpellcheckScreen({
  project,
  dispatch,
  user,
}: {
  project: AakaroProject;
  dispatch: Dispatch<ProjectAction>;
  user: User | null;
}) {
  const kit = project.brandKit.confirmed;
  const spellcheck = project.spellcheck;
  const review = spellcheck.review;
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // Leaving the screen (or losing the session) cancels an in-flight review.
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!kit) {
    return (
      <section
        className="clay tile spellcheck-blocked"
        aria-label="Brand Spellcheck blocked"
      >
        <span className="eyebrow">Brand Spellcheck</span>
        <h1 className="tile-hero">Confirm your brand kit first.</h1>
        <p>
          Spellcheck compares content with your confirmed rules, so nothing can
          be checked until the kit is locked.
        </p>
        <div className="tile-actions">
          <button
            className="btn btn-primary"
            onClick={() => dispatch({ type: "backToBrandKit" })}
          >
            Back to brand kit
          </button>
        </div>
      </section>
    );
  }

  const reviewing = checking || spellcheck.status === "reviewing";
  const hasContent = spellcheck.workingContent.trim().length > 0;
  const checked = review !== null && !review.stale;
  const compliant = checked && review.issues.length === 0;
  const ruleFor = (issue: SpellcheckIssue): BrandRule | undefined =>
    kit.rules.find((rule) => rule.id === issue.ruleId);
  const fixTarget = (issue: SpellcheckIssue): string | null => {
    if (!issue.replacement) return null;
    const next = applyReplacement(spellcheck.workingContent, issue);
    return next !== null && next.length <= CONTENT_MAX ? next : null;
  };

  const runCheck = async () => {
    if (checking || !hasContent || spellcheck.status === "complete") return;
    const expected = project.revision;
    const content = spellcheck.workingContent;
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "spellcheckReviewStart", expectedRevision: expected });
    setChecking(true);
    setError(null);
    try {
      const result = await reviewSpellcheck(kit, content, user, controller.signal);
      // The reducer only accepts this at the revision Start left behind, so an
      // edit made while the request was in flight discards it.
      dispatch({
        type: "spellcheckReviewSuccess",
        review: { ...result, stale: false },
        expectedRevision: expected + 1,
      });
    } catch (cause) {
      if (controller.signal.aborted) return;
      dispatch({ type: "spellcheckReviewFailure", expectedRevision: expected + 1 });
      setError(cause instanceof ApiError ? cause.detail.message : CHECK_FAILED);
    } finally {
      setChecking(false);
    }
  };

  const applyFix = (issue: SpellcheckIssue) => {
    const next = fixTarget(issue);
    if (next === null) return;
    dispatch({ type: "spellcheckApplyFix", issueId: issue.id, nextContent: next });
  };

  const statusLabel = reviewing
    ? "Checking…"
    : spellcheck.status === "complete"
      ? "Confirmed ✓"
      : review?.stale
        ? "Needs re-check"
        : checked
          ? "Checked"
          : spellcheck.status === "idle"
            ? "Awaiting content"
            : "Ready to check";
  const statusText = reviewing
    ? "Checking the content against your confirmed rules…"
    : spellcheck.status === "idle"
      ? `${kit.rules.length} confirmed rules are ready to review pasted content.`
      : spellcheck.status === "complete"
        ? "This checked content is confirmed and saved in this browser."
        : review
          ? review.stale
            ? "The content changed after this check. Re-check to validate it."
            : compliant
              ? "No rule conflicts found in the current content."
              : `${review.issues.length} issue${review.issues.length === 1 ? "" : "s"} found in the current content.`
          : "Paste content, then check it against the confirmed rules.";

  return (
    <section className="spellcheck-screen" aria-label="Brand Spellcheck">
      <header className="clay tile spellcheck-head">
        <div className="spellcheck-head-row">
          <div>
            <span className="eyebrow">Brand Spellcheck</span>
            <h1 className="tile-hero">
              {spellcheck.status === "complete"
                ? "Content confirmed."
                : "Check content against your rules."}
            </h1>
          </div>
          <span className={`spellcheck-status status-${spellcheck.status}`} role="status">
            {statusLabel}
          </span>
        </div>
        <p className="status-line">{statusText}</p>
        {checked && !review.aiReviewed && (
          <p className="spellcheck-degraded">
            AI review was unavailable, so only the deterministic rule checks ran
            — tone and context were not reviewed.
          </p>
        )}
      </header>

      <div className="spellcheck-bento">
        <section className="clay tile spellcheck-editor">
          <span className="eyebrow">Your content</span>
          <h2>
            {spellcheck.status === "idle" ? "Paste content to check" : "Working content"}
          </h2>
          <label className="sr-only" htmlFor="spellcheck-content">
            Content to check
          </label>
          <textarea
            id="spellcheck-content"
            className="spellcheck-input"
            value={spellcheck.workingContent}
            maxLength={CONTENT_MAX}
            placeholder="Paste the page copy, post, or announcement you want checked…"
            disabled={spellcheck.status === "complete"}
            onChange={(event) =>
              dispatch({ type: "spellcheckEditContent", text: event.target.value })
            }
          />
          <div className="spellcheck-editor-foot">
            <span className="char-count">
              {spellcheck.workingContent.length} / {CONTENT_MAX}
            </span>
            <button
              className="btn btn-primary"
              disabled={!hasContent || checking || spellcheck.status === "complete"}
              onClick={runCheck}
            >
              {reviewing
                ? "Checking…"
                : review
                  ? review.stale
                    ? "Re-check content"
                    : "Check again"
                  : "Check content"}
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {spellcheck.status !== "idle" &&
            spellcheck.originalContent !== spellcheck.workingContent && (
              <details className="spellcheck-original">
                <summary>Original pasted text (preserved)</summary>
                <p>{spellcheck.originalContent}</p>
              </details>
            )}
        </section>

        <section className="clay tile spellcheck-review" aria-live="polite">
          <span className="eyebrow">Rule-linked review</span>
          {!review ? (
            <p className="field-help">
              Checks run against your {kit.rules.length} confirmed rules.
              Deterministic phrase rules always run; the AI review adds tone and
              context. Nothing is rewritten without your explicit approval.
            </p>
          ) : reviewing ? (
            <p className="generating-note" aria-busy="true">
              Re-reading the content against the confirmed rules…
            </p>
          ) : (
            <>
              {review.stale && (
                <p className="spellcheck-stale-note">
                  This review describes an earlier version of the content.
                  Re-check before applying more fixes or confirming.
                </p>
              )}
              {review.issues.length === 0 ? (
                <div className="spellcheck-clear">
                  <h3>No rule conflicts found.</h3>
                  <p>
                    {review.passedRuleIds.length} of {kit.rules.length} confirmed
                    rules passed
                    {review.aiReviewed ? "." : " (deterministic checks only)."}
                  </p>
                </div>
              ) : (
                <ul className="spellcheck-issues">
                  {review.issues.map((issue) => {
                    const rule = ruleFor(issue);
                    const fix = fixTarget(issue);
                    return (
                      <li
                        key={issue.id}
                        className={`spellcheck-issue severity-${issue.severity}`}
                      >
                        <div className="issue-meta">
                          <span className={`severity-chip severity-${issue.severity}`}>
                            {issue.severity}
                          </span>
                          <span className="category-chip">{issue.category}</span>
                          <span
                            className="rule-chip"
                            title={rule ? rule.rule : "Rule no longer in the confirmed kit"}
                          >
                            {rule ? `Rule ${issue.ruleId}` : `Rule ${issue.ruleId} (removed)`}
                          </span>
                        </div>
                        <blockquote>
                          “{issue.originalText}”
                          {typeof issue.start === "number" &&
                            typeof issue.end === "number" && (
                              <small>
                                {" "}
                                · characters {issue.start}–{issue.end}
                              </small>
                            )}
                        </blockquote>
                        {rule && (
                          <p className="issue-rule-text">Confirmed rule: {rule.rule}</p>
                        )}
                        <p className="issue-explanation">{issue.explanation}</p>
                        <p className="issue-suggestion">Suggestion: {issue.suggestion}</p>
                        {issue.replacement && (
                          <p className="issue-replacement">
                            Replacement: <code>{issue.replacement}</code>
                          </p>
                        )}
                        {issue.replacement ? (
                          <button
                            className="btn btn-secondary btn-small"
                            disabled={fix === null || reviewing}
                            title={
                              fix === null
                                ? "The exact quoted text can no longer be located — edit the content manually instead."
                                : undefined
                            }
                            onClick={() => applyFix(issue)}
                          >
                            {fix === null ? "Apply fix unavailable" : "Apply fix"}
                          </button>
                        ) : (
                          <p className="field-help">
                            No automatic replacement for this one — edit the content
                            yourself using the suggestion.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </div>

      {checked && (
        <section className="clay tile spellcheck-decision">
          <span className="eyebrow">
            {spellcheck.status === "complete" ? "Spellcheck complete" : "Export and finish"}
          </span>
          <p>
            {spellcheck.status === "complete"
              ? "Your checked content is confirmed. It stays saved in this browser with the rest of your project."
              : compliant
                ? "Every rule check passed. Export the checked content, or finish the spellcheck."
                : "Apply the fixes you accept — or keep the remaining issues — then export or finish."}
          </p>
          <div className="tile-actions">
            <button
              className="btn btn-secondary"
              onClick={() => downloadSpellcheckMarkdown(project)}
            >
              Download Markdown
            </button>
            <button className="btn btn-secondary" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
            {spellcheck.status !== "complete" && (
              <button
                className="btn btn-primary"
                onClick={() =>
                  dispatch({
                    type: "spellcheckComplete",
                    confirmedAt: new Date().toISOString(),
                  })
                }
              >
                Finish spellcheck
              </button>
            )}
          </div>
        </section>
      )}

      <footer className="clay tile spellcheck-foot">
        <div className="tile-actions">
          <button
            className="btn btn-secondary"
            onClick={() => dispatch({ type: "backToBrandKit" })}
          >
            Back to brand kit
          </button>
          {spellcheck.status !== "idle" && (
            <button className="btn btn-secondary" onClick={() => setConfirmNew(true)}>
              Start new check
            </button>
          )}
        </div>
      </footer>

      {confirmNew && (
        <ClayModal
          title="Start a new check?"
          confirmLabel="Clear content"
          onCancel={() => setConfirmNew(false)}
          onConfirm={() => {
            setConfirmNew(false);
            dispatch({ type: "spellcheckNewContent" });
          }}
        >
          <p>
            This clears the pasted content and its review from this project. The
            original text is not recoverable.
          </p>
        </ClayModal>
      )}
    </section>
  );
}
