import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type Dispatch,
} from "react";
import type { User } from "firebase/auth";
import { ApiError, clarifyIdea } from "../../lib/api";
import type { ProjectAction } from "../../lib/project";
import type { AakaroProject } from "../../types/project";

const PLACEHOLDERS = [
  "A sentence or two — what you know, what you don't yet.",
  "Even a rough direction helps; say what you're torn between.",
  "Whatever you answer, Aakaro treats it as a starting point, not a rule.",
];

export function ClarifyScreen({
  project,
  dispatch,
  user,
}: {
  project: AakaroProject;
  dispatch: Dispatch<ProjectAction>;
  user: User | null;
}) {
  const { questions, answers } = project.clarification;
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const active = useRef<AbortController | null>(null);
  const expectedRevision = useRef(0);

  useEffect(() => {
    if (questions.length > 0) return;
    const controller = new AbortController();
    active.current = controller;
    expectedRevision.current = project.revision;
    setPending(true);
    setError(null);
    clarifyIdea(project.idea.rawIdea, user, controller.signal)
      .then((generated) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: "clarifySuccess",
          questions: generated,
          expectedRevision: expectedRevision.current,
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof ApiError
            ? reason.message
            : "We couldn't generate the questions. Try again.",
        );
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setPending(false);
        active.current = null;
      });
    return () => controller.abort();
    // Regenerate only when questions are missing or a retry is requested.
  }, [questions.length, attempt]);

  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );

  if (questions.length === 0) {
    return (
      <section className="bento clarify-bento" aria-label="Generating questions">
        <div className="clay tile tile-question">
          <span className="eyebrow">Clarify</span>
          <h1 className="tile-hero">Reading your idea closely.</h1>
          {error ? (
            <>
              <div className="error" role="alert">
                <p>{error}</p>
              </div>
              <div className="tile-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => dispatch({ type: "backToIdea" })}
                >
                  <span aria-hidden="true">←</span> Back to your idea
                </button>
                <span className="spacer" />
                <button
                  className="btn btn-primary"
                  onClick={() => setAttempt((v) => v + 1)}
                >
                  Try again
                </button>
              </div>
            </>
          ) : (
            <div className="generating" role="status">
              <div className="clay-stack" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p>
                {pending
                  ? "Preparing three questions that fit what you told us — this takes a few seconds."
                  : "Getting ready…"}
              </p>
              <p className="generating-note">Your idea is saved while you wait.</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  const question = questions[Math.min(index, questions.length - 1)];
  const answer =
    answers.find((a) => a.questionId === question.id)?.answer ?? "";
  const isLast = index === questions.length - 1;

  function goBack() {
    if (index > 0) setIndex(index - 1);
    else dispatch({ type: "backToIdea" });
  }

  function goForward() {
    if (!answer.trim() || pending) return;
    if (isLast) dispatch({ type: "enterStrategy" });
    else setIndex(index + 1);
  }

  return (
    <section className="bento clarify-bento" aria-label="Clarification questions">
      <div className="clay tile tile-question">
        <span className="eyebrow">
          Clarify · Question {index + 1} of {questions.length}
        </span>
        <div className="question-swap" key={question.id}>
          <h2 className="question-text">{question.question}</h2>
          <label htmlFor="answer" className="sr-only">
            Your answer
          </label>
          <textarea
            id="answer"
            className="answer-input"
            maxLength={1200}
            value={answer}
            placeholder={PLACEHOLDERS[Math.min(index, PLACEHOLDERS.length - 1)]}
            onChange={(e) =>
              dispatch({
                type: "setAnswer",
                questionId: question.id,
                answer: e.target.value,
              })
            }
          />
        </div>
        <p className="field-help">
          <button
            type="button"
            className="text-button"
            onClick={() =>
              dispatch({
                type: "setAnswer",
                questionId: question.id,
                answer: "Not sure yet.",
              })
            }
          >
            I&rsquo;m not sure
          </button>
          <span className="char-count">{answer.length}/1,200</span>
        </p>
        <div className="tile-actions">
          <button className="btn btn-secondary" onClick={goBack}>
            <span aria-hidden="true">←</span> Back
          </button>
          <span className="spacer" />
          <button
            className="btn btn-primary"
            disabled={!answer.trim()}
            onClick={goForward}
          >
            {isLast ? "Build my strategy" : "Continue"}{" "}
            <span className="btn-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className="tile-stack">
        <div className="clay tile tile-progress">
          <span className="eyebrow">Progress</span>
          <div className="q-dots" aria-hidden="true">
            {questions.map((q, i) => (
              <Fragment key={q.id}>
                {i > 0 && <span className={i <= index ? "q-line done" : "q-line"} />}
                <span className={i === index ? "q-dot current" : i < index ? "q-dot done" : "q-dot"}>
                  {i < index ? "✓" : i + 1}
                </span>
              </Fragment>
            ))}
          </div>
        </div>
        <div className="clay tile tile-why">
          <span className="eyebrow">Why we ask</span>
          <p>{question.reason}</p>
        </div>
        <div className="clay tile tile-tip">
          <p>Answers are saved as you type. Go back any time.</p>
        </div>
      </div>
    </section>
  );
}
