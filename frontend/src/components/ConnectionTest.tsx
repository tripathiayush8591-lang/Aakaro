import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "firebase/auth";
import { ApiError, checkHealth, testConnection } from "../lib/api";
import type { ConnectionResult, Success } from "../types/api";

export function ConnectionTest({
  user,
  onLogout,
  signingOut,
}: {
  user: User;
  onLogout: () => void;
  signingOut: boolean;
}) {
  const [idea, setIdea] = useState("");
  const [health, setHealth] = useState("Checking backend…");
  const [healthAttempt, setHealthAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Success<ConnectionResult> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const controller = new AbortController();
    setHealth("Checking backend…");
    checkHealth(controller.signal)
      .then(() => {
        if (!controller.signal.aborted) setHealth("Backend connected");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setHealth("Backend unavailable — check the server and API address.");
      });
    return () => controller.abort();
  }, [healthAttempt]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (active.current || !idea.trim() || signingOut) return;
    const controller = new AbortController();
    active.current = controller;
    setPending(true);
    setError(null);
    try {
      const response = await testConnection(idea, user, controller.signal);
      if (!controller.signal.aborted) setResult(response);
    } catch (reason) {
      if (!controller.signal.aborted)
        setError(
          reason instanceof ApiError
            ? reason
            : new ApiError({
                code: "REQUEST_FAILED",
                message: "The request failed. Please retry.",
                retryable: true,
              }),
        );
    } finally {
      if (!controller.signal.aborted) {
        setPending(false);
        active.current = null;
      }
    }
  }
  return (
    <main className="workspace">
      <header className="workspace-header">
        <div>
          <strong className="wordmark">aakaro</strong>
          <p className="muted">Give your idea an identity.</p>
        </div>
        <div className="account">
          <span>
            {user.displayName || user.email || "Signed in"}
            {user.displayName && user.email && <small>{user.email}</small>}
          </span>
          <button
            className="secondary"
            onClick={onLogout}
            disabled={signingOut}
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </header>
      <section className="diagnostic">
        <span className="eyebrow">Phase 1 · Temporary diagnostic</span>
        <h1>Let’s make the connection.</h1>
        <p className="muted">
          Test a short idea with Gemini. This checks the foundation; it doesn’t
          create a brand kit.
        </p>
        <div className="connection-status">
          <p role="status">{health}</p>
          <button
            className="text-button"
            onClick={() => setHealthAttempt((v) => v + 1)}
          >
            Recheck backend
          </button>
        </div>
        <form onSubmit={submit}>
          <label htmlFor="idea">Your idea</label>
          <textarea
            id="idea"
            maxLength={1000}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="An app helping students find hackathon teammates."
            required
            aria-describedby="idea-help"
          />
          <p id="idea-help" className="field-help">
            A sentence or two is enough. <span>{idea.length}/1,000</span>
          </p>
          <button
            className="primary"
            disabled={pending || signingOut || !idea.trim()}
          >
            {pending
              ? "Testing AI connection…"
              : error
                ? "Retry AI connection"
                : "Test AI connection"}
          </button>
        </form>
        <p role="status" className="muted">
          {pending
            ? "Waiting for Gemini…"
            : error
              ? "AI connection test failed"
              : result
                ? "AI connected — response validated"
                : "AI connection not tested yet"}
        </p>
        {error && (
          <div className="error" role="alert">
            <p>{error.message}</p>
            <small>
              {error.detail.code}
              {error.requestId && ` · Request ${error.requestId}`}
            </small>
          </div>
        )}
        {result && (
          <section className="result" aria-label="AI response">
            <h2>
              {error || pending
                ? "Last successful response"
                : "Your idea, reflected back"}
            </h2>
            <dl>
              <dt>Summary</dt>
              <dd>{result.data.summary}</dd>
              <dt>Possible audience</dt>
              <dd>{result.data.possibleAudience}</dd>
              <dt>A question to consider</dt>
              <dd>{result.data.clarifyingQuestion}</dd>
            </dl>
            <small className="muted">
              Generated by Gemini · Request {result.requestId}
            </small>
          </section>
        )}
      </section>
    </main>
  );
}
