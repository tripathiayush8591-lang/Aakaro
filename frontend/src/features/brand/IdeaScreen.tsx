import type { Dispatch } from "react";
import type { ProjectAction } from "../../lib/project";

const NEXT_STEPS = [
  { label: "Clarify", note: "Three quick questions" },
  { label: "Strategy", note: "Your brand foundation" },
  { label: "Naming", note: "Directions and alternatives" },
  { label: "Identity", note: "Voice, colors, and kit" },
];

export function IdeaScreen({
  idea,
  dispatch,
}: {
  idea: string;
  dispatch: Dispatch<ProjectAction>;
}) {
  const ready = idea.trim().length > 0;
  return (
    <section className="bento idea-bento" aria-label="Start with the idea">
      <div className="clay tile tile-input">
        <span className="eyebrow">Start your brand</span>
        <h1 className="tile-hero">Tell us what you&rsquo;re building.</h1>
        <label htmlFor="idea" className="sr-only">
          Your idea
        </label>
        <textarea
          id="idea"
          className="idea-input"
          maxLength={1000}
          value={idea}
          onChange={(e) => dispatch({ type: "setIdea", text: e.target.value })}
          placeholder="A platform that helps college students find the right teammates for hackathons based on skills and interests…"
        />
        <div className="tile-foot">
          <p className="tile-hint">Say it the way you&rsquo;d say it to a friend.</p>
          <div className="tile-foot-end">
            <span className="char-count">{idea.length}/1,000</span>
            <button
              className="btn btn-primary"
              disabled={!ready}
              onClick={() => dispatch({ type: "enterClarification" })}
            >
              Shape my idea <span className="btn-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      </div>

      <div className="tile-stack">
        <div className="clay tile tile-progress" aria-label="Stage progress">
          <span className="tile-step-num">01</span>
          <div>
            <span className="eyebrow">Stage</span>
            <p className="tile-step-label">Idea</p>
          </div>
        </div>
        <div className="clay tile tile-next">
          <span className="eyebrow">What happens next</span>
          <ol className="next-steps">
            {NEXT_STEPS.map((step, index) => (
              <li key={step.label}>
                <span className="next-step-index" aria-hidden="true">
                  {index + 1}
                </span>
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.note}</small>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <div className="clay tile tile-tip">
          <p>
            One or two honest sentences are plenty — Aakaro asks what matters
            before shaping the brand around it.
          </p>
        </div>
      </div>
    </section>
  );
}
