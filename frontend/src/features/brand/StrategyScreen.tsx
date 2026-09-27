import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { ApiError, generateStrategy } from "../../lib/api";
import type { ProjectAction } from "../../lib/project";
import type { AakaroProject, StrategyBrief } from "../../types/project";

const STATUS_LINES = [
  "Understanding your audience",
  "Finding the central promise",
  "Defining your positioning",
  "Mapping naming territories",
];

function generatingView(
  error: string | null,
  statusIndex: number,
  onRetry: () => void,
  onBack: () => void,
) {
  return (
    <section className="bento" aria-label="Generating strategy">
      <div className="clay tile tile-question">
        <span className="eyebrow">Strategy</span>
        <h1 className="tile-hero">Finding the shape of your brand.</h1>
        {error ? (
          <>
            <div className="error" role="alert">
              <p>{error}</p>
            </div>
            <div className="tile-actions">
              <button className="btn btn-secondary" onClick={onBack}>
                <span aria-hidden="true">←</span> Revise answers
              </button>
              <span className="spacer" />
              <button className="btn btn-primary" onClick={onRetry}>
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
            <ul className="status-lines">
              {STATUS_LINES.map((line, i) => (
                <li key={line} className={i === statusIndex ? "current" : ""}>
                  <span className="status-marker" aria-hidden="true">
                    {i === statusIndex ? "●" : "○"}
                  </span>
                  {line}
                </li>
              ))}
            </ul>
            <p className="generating-note">Your answers are saved while you wait.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function missingSections(brief: StrategyBrief): string[] {
  const missing: string[] = [];
  if (!brief.oneLiner.trim()) missing.push("One-liner");
  if (!brief.audience.primary.trim() || !brief.audience.description.trim())
    missing.push("Audience");
  if (!brief.problem.trim()) missing.push("The problem");
  if (!brief.promise.trim()) missing.push("The promise");
  if (!brief.differentiation.trim()) missing.push("Differentiation");
  if (brief.personality.filter((t) => t.trim()).length < 3)
    missing.push("Personality (three traits)");
  if (!brief.positioning.trim()) missing.push("Positioning");
  if (brief.namingTerritories.filter((t) => t.trim()).length < 2)
    missing.push("Naming territories (at least two)");
  return missing;
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.6 2.6a1.9 1.9 0 0 1 2.7 0l1.1 1.1a1.9 1.9 0 0 1 0 2.7l-9.6 9.6-4.2 1.1 1.1-4.2 9.6-9.6Z"
      />
    </svg>
  );
}

function BriefTile({
  label,
  tone,
  span,
  editing,
  onStart,
  onEnd,
  children,
  editControl,
}: {
  label: string;
  tone?: string;
  span?: string;
  editing: boolean;
  onStart: () => void;
  onEnd: () => void;
  children: ReactNode;
  editControl: ReactNode;
}) {
  return (
    <div
      className={`clay tile brief-tile ${tone ?? ""} ${span ?? ""} ${editing ? "editing" : ""}`}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onEnd();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onEnd();
      }}
    >
      <div className="tile-head">
        <span className="eyebrow">{label}</span>
        {!editing && (
          <button className="tile-edit" onClick={onStart} aria-label={`Edit ${label}`}>
            <PencilIcon />
          </button>
        )}
      </div>
      {editing ? editControl : children}
    </div>
  );
}

function ReviewScreen({
  project,
  dispatch,
}: {
  project: AakaroProject;
  dispatch: Dispatch<ProjectAction>;
}) {
  const draft = project.strategy.draft;
  const [editingField, setEditingField] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  if (!draft) return null;
  const brief: StrategyBrief = draft;
  const update = (patch: Partial<StrategyBrief>) =>
    dispatch({ type: "editStrategy", draft: { ...brief, ...patch } });
  const endEdit = () => setEditingField(null);

  function lock() {
    const missing = missingSections(brief);
    setErrors(missing);
    if (missing.length === 0)
      dispatch({ type: "confirmStrategy", confirmedAt: new Date().toISOString() });
  }

  function reviseAnswers() {
    if (
      window.confirm(
        "Going back clears the generated strategy draft. Your answers stay. Continue?",
      )
    )
      dispatch({ type: "reviseAnswers" });
  }

  const textControl = (
    field: "oneLiner" | "problem" | "promise" | "differentiation" | "positioning",
    label: string,
    multiline: boolean,
  ) =>
    multiline ? (
      <textarea
        className="brief-textarea"
        value={brief[field]}
        maxLength={800}
        aria-label={label}
        autoFocus
        onChange={(e) => update({ [field]: e.target.value })}
      />
    ) : (
      <input
        className="brief-input"
        value={brief[field]}
        maxLength={field === "oneLiner" ? 240 : 800}
        aria-label={label}
        autoFocus
        onChange={(e) => update({ [field]: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === "Enter") endEdit();
        }}
      />
    );

  return (
    <section className="bento review-bento" aria-label="Strategy review">
      <h1 className="review-title">The strategy your identity will be built on.</h1>
      <p className="review-lede">
        Read it like a brief. Click any tile to edit — then lock it to move to
        naming.
      </p>
      {errors.length > 0 && (
        <div className="error" role="alert">
          <p>These sections still need content: {errors.join(", ")}.</p>
        </div>
      )}
      <div className="bento-grid">
        <BriefTile
          label="One-liner"
          span="span-2"
          editing={editingField === "oneLiner"}
          onStart={() => setEditingField("oneLiner")}
          onEnd={endEdit}
          editControl={textControl("oneLiner", "One-liner", false)}
        >
          <p className="brief-value large">{brief.oneLiner}</p>
        </BriefTile>
        <BriefTile
          label="Personality"
          tone="tone-lavender"
          editing={editingField === "personality"}
          onStart={() => setEditingField("personality")}
          onEnd={endEdit}
          editControl={
            <div className="trait-inputs">
              {brief.personality.map((trait, i) => (
                <input
                  key={i}
                  className="brief-input"
                  value={trait}
                  maxLength={60}
                  aria-label={`Personality trait ${i + 1}`}
                  autoFocus={i === 0}
                  onChange={(e) => {
                    const personality = [...brief.personality];
                    personality[i] = e.target.value;
                    update({ personality });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") endEdit();
                  }}
                />
              ))}
            </div>
          }
        >
          <ul className="trait-list">
            {brief.personality.map((trait, i) => (
              <li key={i}>{trait.trim() || "—"}</li>
            ))}
          </ul>
        </BriefTile>

        <BriefTile
          label="Audience"
          tone="tone-blue"
          editing={editingField === "audience"}
          onStart={() => setEditingField("audience")}
          onEnd={endEdit}
          editControl={
            <div>
              <input
                className="brief-input"
                value={brief.audience.primary}
                maxLength={160}
                aria-label="Primary audience"
                placeholder="Who this serves"
                autoFocus
                onChange={(e) =>
                  update({
                    audience: { ...brief.audience, primary: e.target.value },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") endEdit();
                }}
              />
              <textarea
                className="brief-textarea"
                value={brief.audience.description}
                maxLength={800}
                aria-label="Audience description"
                onChange={(e) =>
                  update({
                    audience: { ...brief.audience, description: e.target.value },
                  })
                }
              />
            </div>
          }
        >
          <p className="brief-value">
            <strong>{brief.audience.primary}.</strong> {brief.audience.description}
          </p>
        </BriefTile>
        <BriefTile
          label="The problem"
          editing={editingField === "problem"}
          onStart={() => setEditingField("problem")}
          onEnd={endEdit}
          editControl={textControl("problem", "The problem", true)}
        >
          <p className="brief-value">{brief.problem}</p>
        </BriefTile>
        <BriefTile
          label="Positioning"
          editing={editingField === "positioning"}
          onStart={() => setEditingField("positioning")}
          onEnd={endEdit}
          editControl={textControl("positioning", "Positioning", true)}
        >
          <p className="brief-value">{brief.positioning}</p>
        </BriefTile>

        <BriefTile
          label="The promise"
          tone="tone-lime"
          span="span-2"
          editing={editingField === "promise"}
          onStart={() => setEditingField("promise")}
          onEnd={endEdit}
          editControl={textControl("promise", "The promise", true)}
        >
          <p className="brief-value">{brief.promise}</p>
        </BriefTile>
        <BriefTile
          label="Naming territories"
          tone="tone-peach"
          editing={editingField === "namingTerritories"}
          onStart={() => setEditingField("namingTerritories")}
          onEnd={endEdit}
          editControl={
            <div>
              <input
                className="brief-input"
                value={brief.namingTerritories.join(", ")}
                aria-label="Naming territories"
                placeholder="Comma-separated, two to four territories"
                autoFocus
                onChange={(e) =>
                  update({
                    namingTerritories: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") endEdit();
                }}
              />
              <p className="brief-hint">Comma-separated; two to four directions.</p>
            </div>
          }
        >
          <ul className="territory-list">
            {brief.namingTerritories.map((territory, i) => (
              <li key={i}>{territory.trim() || "—"}</li>
            ))}
          </ul>
        </BriefTile>

        <BriefTile
          label="Differentiation"
          span="span-3"
          editing={editingField === "differentiation"}
          onStart={() => setEditingField("differentiation")}
          onEnd={endEdit}
          editControl={textControl("differentiation", "Differentiation", true)}
        >
          <p className="brief-value">{brief.differentiation}</p>
        </BriefTile>
      </div>
      <div className="tile-actions">
        <button className="btn btn-secondary" onClick={reviseAnswers}>
          <span aria-hidden="true">←</span> Revise answers
        </button>
        <span className="spacer" />
        <button className="btn btn-primary" onClick={lock}>
          Lock strategy <span className="btn-arrow" aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

export function StrategyScreen({
  project,
  dispatch,
  user,
}: {
  project: AakaroProject;
  dispatch: Dispatch<ProjectAction>;
  user: User | null;
}) {
  const draft = project.strategy.draft;
  const [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusIndex, setStatusIndex] = useState(0);
  const active = useRef<AbortController | null>(null);
  const expectedRevision = useRef(0);

  useEffect(() => {
    if (draft) return;
    const controller = new AbortController();
    active.current = controller;
    expectedRevision.current = project.revision;
    setPending(true);
    setError(null);
    setStatusIndex(0);
    generateStrategy(
      project.idea.rawIdea,
      project.clarification.questions.map((question) => ({
        question: question.question,
        answer:
          project.clarification.answers.find((a) => a.questionId === question.id)
            ?.answer ?? "",
      })),
      user,
      controller.signal,
    )
      .then((generated) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: "strategySuccess",
          draft: generated,
          expectedRevision: expectedRevision.current,
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof ApiError
            ? reason.message
            : "We couldn't generate the strategy. Try again.",
        );
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setPending(false);
        active.current = null;
      });
    return () => controller.abort();
  }, [draft === null, attempt]);

  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (draft) return;
    const timer = setInterval(
      () => setStatusIndex((i) => (i + 1) % STATUS_LINES.length),
      2200,
    );
    return () => clearInterval(timer);
  }, [draft === null]);

  if (!draft)
    return generatingView(
      error,
      statusIndex,
      () => setAttempt((v) => v + 1),
      () => dispatch({ type: "reviseAnswers" }),
    );
  return <ReviewScreen project={project} dispatch={dispatch} />;
}
