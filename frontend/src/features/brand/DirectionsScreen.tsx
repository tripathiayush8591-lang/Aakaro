import { useEffect, useRef, useState, type CSSProperties, type Dispatch } from "react";
import type { User } from "firebase/auth";
import type { AakaroProject, BrandDirection } from "../../types/project";
import type { ProjectAction } from "../../lib/project";
import { generateDirections } from "../../lib/api";
import { ClayModal } from "../../components/ClayModal";

const SAFE_ERROR = "We couldn't finish these brand directions. Your naming decision is safe.";

function DirectionBoard({ direction: d, name, selected, onSelect }: {
  direction: BrandDirection; name: string; selected: boolean; onSelect: () => void;
}) {
  // Allowlisted treatments only; model output never becomes arbitrary CSS or HTML.
  const heading = d.typography.headingStyle.toLowerCase();
  const geometric = /square|block|grid|angular/.test(d.logoApproach.approach.toLowerCase());
  const typeStyle: CSSProperties = {
    fontFamily: heading.includes("dm sans") ? "var(--font-body)" : "var(--font-display)",
    fontWeight: /bold|heavy/.test(heading) ? 800 : 500,
    letterSpacing: /spaced|wide/.test(heading) ? ".08em" : "-.05em",
    textTransform: heading.includes("uppercase") ? "uppercase" : heading.includes("lowercase") ? "lowercase" : "none",
  };
  const palette = {
    "--direction-primary": d.colors.primary, "--direction-secondary": d.colors.secondary,
    "--direction-accent": d.colors.accent, "--direction-background": d.colors.background,
  } as CSSProperties;
  return (
    <article className={`clay direction-board ${selected ? "selected" : ""} ${geometric ? "geometric" : "rounded"}`}
      aria-label={`Direction for ${name}`} style={palette}>
      <div className="direction-heading">
        <span className="eyebrow">{d.id === "direction1" ? "01" : "02"} · {d.conceptName}</span>
        <h2>{name}</h2>
        <p>{d.conceptStatement}</p>
        <div className="direction-traits">{d.personality.map(trait => <span key={trait}>{trait}</span>)}</div>
      </div>
      <div className="direction-bento">
        <section className="direction-tile direction-wide">
          <h3>Color palette</h3>
          <div className="direction-swatches">
            {(["primary", "secondary", "accent", "background"] as const).map(role => (
              <div key={role}><span className="color-swatch" style={{ backgroundColor: d.colors[role] }} />
                <span className="swatch-role">{role}</span><code>{d.colors[role]}</code></div>
            ))}
          </div>
          <p>{d.colors.rationale}</p>
        </section>
        <section className="direction-tile direction-wide">
          <h3>Typography preview</h3>
          <div className="direction-type-preview" style={{ ...typeStyle,
            fontSize: /bold|heavy/.test(heading) ? "clamp(32px, 3.5vw, 54px)" : "clamp(28px, 3vw, 46px)",
          }}>{name}</div>
          <p className="direction-detail">{d.typography.headingStyle}</p>
          <p>{d.typography.bodyStyle}</p>
          <details><summary>Why this type</summary><p>{d.typography.rationale}</p></details>
        </section>
        <section className="direction-tile">
          <h3>Logo approach</h3>
          <div className="direction-logo" aria-label="Concept wordmark preview">
            <span className="direction-symbol" aria-hidden="true" /><span style={typeStyle}>{name}</span>
          </div>
          <small>Concept preview · not a final logo</small>
          <p className="direction-detail">{d.logoApproach.approach}</p>
          <details><summary>Why this approach</summary><p>{d.logoApproach.rationale}</p></details>
        </section>
        <section className="direction-tile">
          <h3>Imagery style</h3>
          <div className={`direction-imagery ${/block|grid|square|angular/.test(d.imagery.style.toLowerCase()) ? "blocks" : ""}`} aria-label="Abstract composition preview" role="img">
            <i /><i /><i />
          </div>
          <p className="direction-detail">{d.imagery.style}</p>
          <details><summary>Why this imagery</summary><p>{d.imagery.rationale}</p></details>
        </section>
        <section className="direction-tile direction-wide">
          <h3>Brand voice</h3>
          <div className="direction-traits">{d.voice.traits.map(trait => <span key={trait}>{trait}</span>)}</div>
          <blockquote>“{d.voice.sampleLine}”</blockquote>
        </section>
      </div>
      <button className={`btn direction-select ${selected ? "btn-primary" : "btn-secondary"}`}
        aria-pressed={selected} aria-label={`Select direction for ${name}`} onClick={onSelect}>
        {selected ? "Selected ✓" : "Select direction"}
      </button>
    </article>
  );
}

export function DirectionsScreen({ project, dispatch, user }: {
  project: AakaroProject; dispatch: Dispatch<ProjectAction>; user: User | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"lock" | "naming" | null>(null);
  const active = useRef<AbortController | null>(null);
  const { naming, directions, strategy } = project;
  const shortlisted = naming.selectedIds.flatMap(id => naming.candidates.filter(c => c.id === id));
  const evaluations = naming.selectedIds.flatMap(id => naming.evaluations.filter(e => e.candidateId === id));
  const permitted = !!strategy.confirmed && naming.generationStatus === "confirmed" && shortlisted.length === 2 && evaluations.length === 2;
  const selected = directions.items.find(d => d.id === directions.selectedDirectionId);
  const selectedName = shortlisted.find(c => c.id === selected?.candidateId)?.name;

  useEffect(() => () => active.current?.abort(), []);

  async function generate() {
    if (!permitted || !strategy.confirmed || active.current || directions.status !== "idle") return;
    const controller = new AbortController();
    active.current = controller;
    const expectedRevision = project.revision + 1; // directionsStart commits once.
    setError(null);
    dispatch({ type: "directionsStart", expectedRevision: project.revision });
    try {
      const items = await generateDirections(strategy.confirmed, shortlisted, evaluations, user, controller.signal);
      if (!controller.signal.aborted) dispatch({ type: "directionsSuccess", items, generatedAt: new Date().toISOString(), expectedRevision });
    } catch {
      if (!controller.signal.aborted) {
        setError(SAFE_ERROR);
        dispatch({ type: "directionsFailure", expectedRevision });
      }
    } finally {
      if (active.current === controller) active.current = null;
    }
  }

  if (!permitted) return (
    <section className="clay tile" aria-label="Directions blocked">
      <span className="eyebrow">Brand directions</span><h1>Confirm your naming decision first.</h1>
      <p>Two shortlisted names and a locked strategy are needed to build your directions.</p>
      <button className="btn btn-secondary" onClick={() => dispatch({ type: "backToNaming" })}>← Back to {strategy.confirmed ? "naming" : "strategy"}</button>
    </section>
  );

  if (directions.status === "confirmed" && selected) return (
    <section className="bento review-bento" aria-label="Brand Kit ready">
      <div className="clay tile locked-hero">
        <span className="eyebrow">Direction locked ✓</span><h1 className="tile-hero">Brand Kit-ready.</h1>
        <h2>{selectedName} · {selected.conceptName}</h2><p className="review-lede">{selected.conceptStatement}</p>
        <p>Your chosen direction is saved as the foundation of your Brand Kit. Kit generation comes next.</p>
        <button className="btn btn-secondary" onClick={() => dispatch({ type: "unlockDirection" })}>Unlock direction</button>
      </div>
    </section>
  );

  if (directions.status === "generating") return (
    <section className="clay tile locked-hero" aria-label="Generating brand directions" aria-busy="true">
      <span className="eyebrow">Brand directions</span><h1 className="tile-hero">Shaping your visual identity</h1>
      <div className="direction-progress" role="status">
        <p>Exploring color relationships</p><p>Mapping typography personality</p><p>Defining visual character</p>
      </div><p className="generation-note">Your naming decision is saved while you wait.</p>
    </section>
  );

  return (
    <section className="bento review-bento" aria-label="Brand directions">
      <div className={directions.status === "idle" ? "clay tile locked-hero" : "directions-intro"}>
        <span className="eyebrow">Brand directions</span>
        <h1 className="tile-hero">Two ways your identity could come alive.</h1>
        <p className="review-lede">{shortlisted.map(c => c.name).join(" + ")} · Two distinct expressions of your locked strategy. The choice is yours.</p>
        {error && <p className="error" role="alert">{error}</p>}
        {directions.status === "idle" && <div className="tile-actions">
          <button className="btn btn-secondary" onClick={() => setModal("naming")}>Revisit naming</button>
          <span className="spacer" /><button className="btn btn-primary" onClick={() => void generate()}>{error ? "Try again" : "Build my directions"} →</button>
        </div>}
      </div>
      {directions.status === "ready" && <>
        <div className="directions-grid">
          {directions.items.map(d => <DirectionBoard key={d.id} direction={d}
            name={shortlisted.find(c => c.id === d.candidateId)!.name}
            selected={directions.selectedDirectionId === d.id}
            onSelect={() => dispatch({ type: "selectDirection", id: d.id })} />)}
        </div>
        <div className="clay tile direction-decision">
          <p role="status">{selected ? `${selectedName} · ${selected.conceptName} selected.` : "Choose the direction you want to develop."}</p>
          <div className="tile-actions">
            <button className="btn btn-secondary" onClick={() => setModal("naming")}>Revisit naming</button>
            <span className="spacer" /><button className="btn btn-primary" disabled={!selected} onClick={() => setModal("lock")}>Lock this direction →</button>
          </div>
        </div>
      </>}
      {modal === "lock" && selected && <ClayModal title="Lock this direction?" confirmLabel="Lock direction"
        onCancel={() => setModal(null)} onConfirm={() => { setModal(null); dispatch({ type: "confirmDirection", confirmedAt: new Date().toISOString() }); }}>
        <p className="modal-selection">{selectedName} · {selected.conceptName}</p>
        <p>This will become the foundation of your Brand Kit.</p>
      </ClayModal>}
      {modal === "naming" && <ClayModal title="Revisit your shortlist?" confirmLabel="Revisit naming"
        onCancel={() => setModal(null)} onConfirm={() => { setModal(null); dispatch({ type: "unlockNaming" }); }}>
        <p>This unlocks your two-name shortlist and clears these directions. Your five candidates and their evaluations stay saved.</p>
      </ClayModal>}
    </section>
  );
}
