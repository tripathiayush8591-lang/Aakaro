import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import {
  ApiError,
  evaluateNamingCandidates,
  generateNamingCandidates,
} from "../../lib/api";
import type { ProjectAction } from "../../lib/project";
import type {
  AakaroProject,
  NamingCandidate,
  NamingEvaluation,
  NamingScores,
} from "../../types/project";

const GENERATING_LINES = [
  "Mining your naming territories",
  "Shaping five distinct candidates",
  "Stress-testing how each one sounds",
  "Matching names to your positioning",
];

const EVALUATING_LINES = [
  "Scoring distinctiveness and strategic fit",
  "Weighing memorability and extensibility",
  "Writing honest trade-offs for each name",
];

const SCORE_ROWS: { key: keyof NamingScores; label: string }[] = [
  { key: "distinctiveness", label: "Distinctive" },
  { key: "strategicFit", label: "Strategic fit" },
  { key: "memorability", label: "Memorable" },
  { key: "extensibility", label: "Extensible" },
];

function statusView(
  lines: string[],
  statusIndex: number,
  note: string,
): ReactNode {
  return (
    <div className="generating" role="status">
      <div className="clay-stack" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <ul className="status-lines">
        {lines.map((line, i) => (
          <li key={line} className={i === statusIndex ? "current" : ""}>
            <span className="status-marker" aria-hidden="true">
              {i === statusIndex ? "●" : "○"}
            </span>
            {line}
          </li>
        ))}
      </ul>
      <p className="generating-note">{note}</p>
    </div>
  );
}

function StrategyTiles({ confirmed }: { confirmed: NonNullable<AakaroProject["strategy"]["confirmed"]> }) {
  return (
    <div className="bento-grid">
      <div className="clay tile brief-tile span-2">
        <div className="tile-head">
          <span className="eyebrow">One-liner</span>
        </div>
        <p className="brief-value large">{confirmed.oneLiner}</p>
      </div>
      <div className="clay tile brief-tile tone-blue">
        <div className="tile-head">
          <span className="eyebrow">Audience</span>
        </div>
        <p className="brief-value">
          <strong>{confirmed.audience.primary}.</strong>{" "}
          {confirmed.audience.description}
        </p>
      </div>
      <div className="clay tile brief-tile tone-peach span-2">
        <div className="tile-head">
          <span className="eyebrow">Naming territories</span>
        </div>
        <ul className="territory-list">
          {confirmed.namingTerritories.map((territory, i) => (
            <li key={i}>{territory}</li>
          ))}
        </ul>
      </div>
      <div className="clay tile tile-tip">
        <p>
          Exactly five candidates will be generated, all five evaluated — then
          you shortlist two. The other three are recorded in The Graveyard.
        </p>
      </div>
    </div>
  );
}

function TombstoneIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10 2.6a4.6 4.6 0 0 1 4.6 4.6v7H14v3H6v-3h-.6v-7A4.6 4.6 0 0 1 10 2.6Z"
      />
    </svg>
  );
}

function Graveyard({
  entries,
  recorded,
  defaultOpen,
}: {
  entries: { candidate: NamingCandidate; evaluation: NamingEvaluation }[];
  recorded: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className={`graveyard ${recorded ? "recorded" : ""}`}
      aria-label="The Graveyard — alternatives we evaluated"
    >
      <button
        type="button"
        className="graveyard-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="graveyard-icon" aria-hidden="true">
          <TombstoneIcon />
        </span>
        <span>The Graveyard — alternatives we evaluated</span>
        <span className="graveyard-count">{entries.length}</span>
        <span className="spacer" />
        <span className="graveyard-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="graveyard-body">
          <p className="graveyard-note">
            {recorded
              ? "Recorded when you confirmed your naming decision. Rejected for this brief — not objectively bad."
              : "These three will be recorded in The Graveyard when you confirm your two shortlisted names."}
          </p>
          {entries.map(({ candidate, evaluation }) => (
            <div className="clay graveyard-entry" key={candidate.id}>
              <div className="graveyard-entry-head">
                <h4>{candidate.name}</h4>
                <span className="eyebrow">{candidate.territory}</span>
              </div>
              <p className="graveyard-reason">{evaluation.verdict}</p>
              <ul className="mini-list risks">
                {evaluation.risks.map((risk, i) => (
                  <li key={i}>
                    <span className="marker" aria-hidden="true">
                      △
                    </span>
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function CandidateCard({
  candidate,
  evaluation,
  selected,
  selectionFull,
  onToggle,
}: {
  candidate: NamingCandidate;
  evaluation: NamingEvaluation;
  selected: boolean;
  selectionFull: boolean;
  onToggle: () => void;
}) {
  return (
    <article
      className={`clay tile candidate-card ${selected ? "selected" : ""}`}
      aria-label={`Candidate ${candidate.name}`}
    >
      <div className="tile-head">
        <span className="eyebrow">{candidate.territory}</span>
        <button
          type="button"
          className={`btn btn-small select-btn ${selected ? "btn-selected" : ""}`}
          aria-pressed={selected}
          aria-label={`${selected ? "Shortlisted" : "Shortlist"} ${candidate.name}`}
          disabled={selectionFull && !selected}
          title={
            selectionFull && !selected
              ? "Two names are already shortlisted"
              : undefined
          }
          onClick={onToggle}
        >
          {selected ? "Shortlisted ✓" : "Shortlist"}
        </button>
      </div>
      <h3 className="candidate-name">{candidate.name}</h3>
      <p className="candidate-rationale">{candidate.rationale}</p>
      {candidate.linguisticNote && (
        <p className="candidate-note">{candidate.linguisticNote}</p>
      )}
      <div className="score-grid" aria-label={`${candidate.name} scores`}>
        {SCORE_ROWS.map(({ key, label }) => {
          const value = evaluation.scores[key];
          return (
            <div className="score-row" key={key}>
              <span className="score-head">
                <span className="score-label">{label}</span>
                <span className="score-value">{value}/5</span>
              </span>
              <span
                className="score-bar"
                role="img"
                aria-label={`${label}: ${value} out of 5`}
              >
                <span className="score-fill" style={{ width: `${value * 20}%` }} />
              </span>
            </div>
          );
        })}
      </div>
      <div className="candidate-lists">
        <div>
          <span className="eyebrow">Strengths</span>
          <ul className="mini-list strengths">
            {evaluation.strengths.map((strength, i) => (
              <li key={i}>
                <span className="marker" aria-hidden="true">
                  ✓
                </span>
                {strength}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <span className="eyebrow">Risks</span>
          <ul className="mini-list risks">
            {evaluation.risks.map((risk, i) => (
              <li key={i}>
                <span className="marker" aria-hidden="true">
                  △
                </span>
                {risk}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="candidate-verdict">{evaluation.verdict}</p>
    </article>
  );
}

function ShortlistView({
  project,
  dispatch,
}: {
  project: AakaroProject;
  dispatch: Dispatch<ProjectAction>;
}) {
  const naming = project.naming;
  const evaluationFor = new Map(
    naming.evaluations.map((e) => [e.candidateId, e]),
  );
  const selectedCount = naming.selectedIds.length;
  const complete = selectedCount === 2;
  const graveyardEntries = naming.candidates
    .filter((c) => !naming.selectedIds.includes(c.id))
    .map((candidate) => ({
      candidate,
      evaluation: evaluationFor.get(candidate.id)!,
    }));

  function confirm() {
    if (
      window.confirm(
        "Confirm these two names? The other three will be recorded in The Graveyard for this project.",
      )
    )
      dispatch({ type: "confirmNaming", confirmedAt: new Date().toISOString() });
  }

  function unlock() {
    if (
      window.confirm(
        "Going back clears the five candidates and their evaluation. Continue?",
      )
    )
      dispatch({ type: "unlockStrategy" });
  }

  return (
    <section className="bento review-bento" aria-label="Shortlist two names">
      <h1 className="review-title">Five names, evaluated.</h1>
      <p className="review-lede">
        Every candidate was scored against your locked strategy. Shortlist
        exactly two — the remaining three automatically enter The Graveyard.
      </p>
      <p className="shortlist-status" role="status">
        {selectedCount} of 2 shortlisted
        {complete ? " — ready to confirm." : " · pick " + (2 - selectedCount) + " more"}
      </p>
      <div className="bento-grid naming-grid">
        {naming.candidates.map((candidate) => {
          const evaluation = evaluationFor.get(candidate.id)!;
          const selected = naming.selectedIds.includes(candidate.id);
          return (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              evaluation={evaluation}
              selected={selected}
              selectionFull={!selected && selectedCount >= 2}
              onToggle={() =>
                dispatch({ type: "toggleShortlist", candidateId: candidate.id })
              }
            />
          );
        })}
      </div>
      {complete && (
        <Graveyard entries={graveyardEntries} recorded={false} defaultOpen />
      )}
      <div className="tile-actions">
        <button className="btn btn-secondary" onClick={unlock}>
          <span aria-hidden="true">←</span> Unlock to edit strategy
        </button>
        <span className="spacer" />
        <button
          className="btn btn-primary"
          disabled={!complete}
          onClick={confirm}
        >
          Confirm naming decision{" "}
          <span className="btn-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </div>
    </section>
  );
}

export function NamingScreen({
  project,
  dispatch,
  user,
}: {
  project: AakaroProject;
  dispatch: Dispatch<ProjectAction>;
  user: User | null;
}) {
  const naming = project.naming;
  const confirmed = project.strategy.confirmed;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [evalAttempt, setEvalAttempt] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);
  const active = useRef<AbortController | null>(null);
  const expectedRevision = useRef(0);

  // Generation is user-triggered and consumes ONLY the confirmed strategy.
  function generate() {
    if (!confirmed || pending) return;
    const controller = new AbortController();
    active.current = controller;
    expectedRevision.current = project.revision;
    setPending(true);
    setError(null);
    setStatusIndex(0);
    generateNamingCandidates(confirmed, user, controller.signal)
      .then((candidates) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: "namingCandidatesSuccess",
          candidates,
          generatedAt: new Date().toISOString(),
          expectedRevision: expectedRevision.current,
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof ApiError
            ? reason.message
            : "We couldn't generate the names. Try again.",
        );
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        setPending(false);
        active.current = null;
      });
  }

  // Evaluation runs automatically once candidates exist; candidates are
  // preserved on failure so only this stage retries.
  useEffect(() => {
    const generated =
      confirmed !== null &&
      naming.candidates.length === 5 &&
      naming.evaluations.length === 0;
    if (!generated || evalError) return;
    const controller = new AbortController();
    active.current = controller;
    expectedRevision.current = project.revision;
    evaluateNamingCandidates(confirmed, naming.candidates, user, controller.signal)
      .then((evaluations) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: "namingEvaluationSuccess",
          evaluations,
          expectedRevision: expectedRevision.current,
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setEvalError(
          reason instanceof ApiError
            ? reason.message
            : "We couldn't complete the evaluation. Try again.",
        );
      });
    return () => controller.abort();
  }, [
    confirmed !== null && naming.candidates.length === 5 && naming.evaluations.length === 0,
    evalAttempt,
    evalError,
  ]);

  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );

  const inFlight =
    pending ||
    (naming.candidates.length === 5 &&
      naming.evaluations.length === 0 &&
      !evalError);
  const lines = pending ? GENERATING_LINES : EVALUATING_LINES;
  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(
      () => setStatusIndex((i) => (i + 1) % lines.length),
      2200,
    );
    return () => clearInterval(timer);
  }, [inFlight, lines.length]);

  if (!confirmed) return null; // Workspace falls back to the strategy screen.

  if (pending)
    return (
      <section className="bento review-bento" aria-label="Generating names">
        <div className="clay tile tile-question">
          <span className="eyebrow">Naming</span>
          <h1 className="tile-hero">Five names, from this exact strategy.</h1>
          {statusView(
            GENERATING_LINES,
            statusIndex % GENERATING_LINES.length,
            "Your locked strategy is saved while you wait.",
          )}
        </div>
      </section>
    );

  if (naming.candidates.length === 0) {
    return (
      <section className="bento review-bento" aria-label="Naming">
        <div className="clay tile locked-hero">
          <span className="eyebrow">Naming</span>
          <h1 className="tile-hero">Strategy locked.</h1>
          <p className="review-lede">
            Naming starts from exactly this strategy — not the draft. Generate
            five candidates, then shortlist the two to carry forward.
          </p>
          {error && (
            <div className="error" role="alert">
              <p>{error}</p>
            </div>
          )}
          <div className="tile-actions">
            <button
              className="btn btn-secondary"
              onClick={() => dispatch({ type: "unlockStrategy" })}
            >
              Unlock to edit
            </button>
            <span className="spacer" />
            <button className="btn btn-primary" onClick={generate}>
              Generate 5 names{" "}
              <span className="btn-arrow" aria-hidden="true">
                →
              </span>
            </button>
          </div>
        </div>
        <StrategyTiles confirmed={confirmed} />
      </section>
    );
  }

  if (naming.evaluations.length === 0) {
    if (evalError)
      return (
        <section className="bento review-bento" aria-label="Evaluation failed">
          <div className="clay tile tile-question">
            <span className="eyebrow">Naming · Evaluation</span>
            <h1 className="tile-hero">Your five names are safe.</h1>
            <div className="error" role="alert">
              <p>{evalError}</p>
            </div>
            <div className="tile-actions">
              <span className="spacer" />
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEvalError(null);
                  setEvalAttempt((v) => v + 1);
                }}
              >
                Evaluate again
              </button>
            </div>
          </div>
        </section>
      );
    return (
      <section className="bento review-bento" aria-label="Evaluating candidates">
        <div className="clay tile tile-question">
          <span className="eyebrow">Naming · Evaluation</span>
          <h1 className="tile-hero">Scoring your five names.</h1>
          {statusView(
            EVALUATING_LINES,
            statusIndex % EVALUATING_LINES.length,
            "Your five candidates are saved while you wait.",
          )}
        </div>
      </section>
    );
  }

  return <ShortlistView project={project} dispatch={dispatch} />;
}

/** Phase 3 stop point: naming is confirmed; brand directions come next. */
export function DirectionsReady({
  project,
  dispatch,
}: {
  project: AakaroProject;
  dispatch: Dispatch<ProjectAction>;
}) {
  const naming = project.naming;
  if (naming.generationStatus !== "confirmed") return null;
  const byId = new Map(naming.candidates.map((c) => [c.id, c]));
  const evaluationFor = new Map(
    naming.evaluations.map((e) => [e.candidateId, e]),
  );
  const shortlisted = naming.selectedIds.flatMap((id) => {
    const candidate = byId.get(id);
    return candidate ? [candidate] : [];
  });
  const graveyardEntries = naming.graveyardIds.flatMap((id) => {
    const candidate = byId.get(id);
    const evaluation = evaluationFor.get(id);
    return candidate && evaluation ? [{ candidate, evaluation }] : [];
  });

  function unlock() {
    if (
      window.confirm(
        "Going back clears the naming decision, all five candidates, and their evaluation. Continue?",
      )
    )
      dispatch({ type: "unlockStrategy" });
  }

  return (
    <section className="bento review-bento" aria-label="Naming confirmed">
      <div className="clay tile locked-hero">
        <span className="eyebrow">Naming confirmed</span>
        <h1 className="tile-hero">Your name is on the door.</h1>
        <p className="review-lede">
          Two shortlisted names carry into brand directions. The Graveyard
          keeps the three we evaluated and set aside, with the reasons.
        </p>
        <div className="tile-actions">
          <button className="btn btn-secondary" onClick={unlock}>
            Unlock strategy (restarts naming)
          </button>
        </div>
      </div>
      <div className="bento-grid">
        {shortlisted.map((candidate, i) => (
          <div
            className={`clay tile brief-tile ${i === 0 ? "tone-blue" : "tone-lime"}`}
            key={candidate.id}
          >
            <div className="tile-head">
              <span className="eyebrow">Shortlisted · {candidate.territory}</span>
            </div>
            <h3 className="candidate-name">{candidate.name}</h3>
            <p className="brief-value">{candidate.rationale}</p>
            <p className="candidate-verdict">
              {evaluationFor.get(candidate.id)?.verdict}
            </p>
          </div>
        ))}
      </div>
      <Graveyard entries={graveyardEntries} recorded defaultOpen={false} />
      <div className="clay tile tile-tip">
        <p>
          Brand directions are the next milestone: each shortlisted name grows
          into a complete direction you can compare side by side.
        </p>
      </div>
    </section>
  );
}
