import { useEffect, useRef, useState, type CSSProperties, type Dispatch } from "react";
import type { User } from "firebase/auth";
import type { AakaroProject, BrandKit } from "../../types/project";
import type { ProjectAction } from "../../lib/project";
import { COLOR_ROLES, kitFoundation, validBrandKit, validHex } from "../../lib/brandKit";
import { generateBrandKit } from "../../lib/api";
import { ClayModal } from "../../components/ClayModal";

function Field({ label, value, onChange, max = 400, locked }: {
  label: string; value: string; onChange: (value: string) => void; max?: number; locked: boolean;
}) {
  return <label className="kit-field"><span>{label}</span>{locked ? <p>{value}</p> :
    <textarea rows={2} maxLength={max} value={value} onChange={e => onChange(e.target.value)}
      aria-invalid={!value.trim()} />}</label>;
}

function wordmarkStyle(kit: BrandKit): CSSProperties {
  return {
    fontFamily: kit.typography.headingStyle.toLowerCase().includes("dm sans") ? "var(--font-body)" : "var(--font-display)",
    textTransform: kit.wordmark.casing === "titlecase" ? "capitalize" : kit.wordmark.casing === "mixed" ? "none" : kit.wordmark.casing,
    letterSpacing: { tight: "-.05em", normal: "0", wide: ".08em" }[kit.wordmark.tracking],
    fontWeight: { regular: 400, medium: 500, semibold: 600, bold: 800 }[kit.wordmark.weight],
  };
}

/** Legible text over arbitrary valid user palette choices, independent of app theme. */
function ink(hex: string) {
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? "#111111" : "#FFFFFF";
}

export function BrandKitPreview({ kit }: { kit: BrandKit }) {
  const heading = kit.typography.headingStyle.toLowerCase();
  return <section className="clay tile kit-preview-frame" aria-label="Live brand preview">
    <span className="eyebrow">Identity in context</span><h2>One coherent identity.</h2>
    <p>Concept preview · text wordmark, not a final logo or website.</p>
    <div className="kit-preview" style={{ background: kit.colors.background, color: ink(kit.colors.background) }}>
      <div className="kit-preview-wordmark" style={{ ...wordmarkStyle(kit), background: kit.colors.primary, color: ink(kit.colors.primary) }}>{kit.identity.name}</div>
      <div className="kit-preview-shapes" aria-hidden="true"><i style={{ background: kit.colors.secondary }} /><i style={{ background: kit.colors.accent }} /></div>
      <h3 style={{ fontFamily: heading.includes("dm sans") ? "var(--font-body)" : "var(--font-display)",
        fontWeight: /bold|heavy/.test(heading) ? 800 : 500, letterSpacing: /wide|spaced/.test(heading) ? ".03em" : "-.04em" }}>{kit.identity.tagline}</h3>
      <p style={{ fontFamily: kit.typography.bodyStyle.toLowerCase().includes("manrope") ? "var(--font-display)" : "var(--font-body)" }}>{kit.identity.descriptor}</p>
      <span className="kit-preview-cta" style={{ background: kit.colors.accent, color: ink(kit.colors.accent) }}>Start building →</span>
    </div>
  </section>;
}

export function BrandKitScreen({ project, dispatch, user }: {
  project: AakaroProject; dispatch: Dispatch<ProjectAction>; user: User | null;
}) {
  const [error, setError] = useState(false);
  const [modal, setModal] = useState<"confirm" | "direction" | null>(null);
  const [hexEdits, setHexEdits] = useState<Partial<BrandKit["colors"]>>({});
  const active = useRef<AbortController | null>(null);
  const foundation = kitFoundation(project);
  const { brandKit } = project;
  const kit = brandKit.draft;
  const locked = brandKit.status === "confirmed";
  useEffect(() => () => active.current?.abort(), []);

  async function generate() {
    if (!foundation || active.current || brandKit.status !== "idle") return;
    const controller = new AbortController(); active.current = controller;
    const expectedRevision = project.revision + 1;
    setError(false);
    dispatch({ type: "brandKitStart", expectedRevision: project.revision });
    try {
      const draft = await generateBrandKit(foundation.strategy, foundation.candidate, foundation.direction, user, controller.signal);
      if (!controller.signal.aborted) dispatch({ type: "brandKitSuccess", draft, expectedRevision, generatedAt: new Date().toISOString() });
    } catch {
      if (!controller.signal.aborted) { setError(true); dispatch({ type: "brandKitFailure", expectedRevision }); }
    } finally { if (active.current === controller) active.current = null; }
  }

  if (!foundation) return <section className="clay tile" aria-label="Brand Kit blocked">
    <h1>Lock one direction first.</h1><p>Your brand kit needs a confirmed strategy, naming decision, and selected direction.</p>
    <button className="btn btn-secondary" onClick={() => dispatch({ type: "backToDirections" })}>← Back to Directions</button>
  </section>;
  if (brandKit.status === "generating") return <section className="clay tile locked-hero" aria-busy="true">
    <h1>Building your brand system</h1><div className="direction-progress" role="status">
      <p>Refining your voice</p><p>Structuring your identity rules</p><p>Preparing your kit</p>
    </div><p>Your selected direction is saved while you wait.</p>
  </section>;
  if (!kit) return <section className="clay tile locked-hero" aria-label="Brand Kit ready">
    <span className="eyebrow">Your brand kit</span><h1 className="tile-hero">Your identity, turned into a system.</h1>
    <h2>{foundation.candidate.name} · {foundation.direction.conceptName}</h2>
    <p><span>Brand Kit-ready.</span> Your locked direction is the foundation for your editable identity and rules.</p>
    {error && <p className="error" role="alert">We couldn't finish your brand kit. Your selected direction is safe.</p>}
    <div className="tile-actions"><button className="btn btn-secondary" onClick={() => dispatch({ type: "unlockDirection" })}>Unlock direction</button>
      <button className="btn btn-primary" onClick={() => void generate()}>{error ? "Try again" : "Build my brand kit"} →</button></div>
  </section>;

  function update<K extends keyof BrandKit>(section: K, value: BrandKit[K]) {
    if (kit && !locked) dispatch({ type: "editBrandKit", draft: { ...kit, [section]: value } });
  }
  const field = (label: string, value: string, onChange: (text: string) => void, max = 400) =>
    <Field label={label} value={value} onChange={onChange} max={max} locked={locked} />;
  const invalidHex = Object.values(hexEdits).some(value => !validHex(value));
  const valid = !invalidHex && validBrandKit(kit, foundation.candidate.name);
  return <section className="kit-screen" aria-label="Your brand kit">
    <header className="directions-intro"><span className="eyebrow">{locked ? "Brand Kit locked ✓" : "Your brand kit"}</span>
      <h1 className="tile-hero">{locked ? "Spellcheck-ready." : "Your identity, turned into a system."}</h1>
      <p>{foundation.candidate.name} · {foundation.direction.conceptName}</p>
      {locked && <p>Your confirmed voice and rules are saved. Brand Spellcheck comes in the next phase.</p>}
    </header>
    <div className="kit-bento">
      <section className="clay tile kit-identity"><span className="eyebrow">01 / Identity</span><h2>{kit.identity.name}</h2>
        <p className="field-hint">Name linked to your confirmed naming decision. Return upstream to rename.</p>
        {field("Tagline", kit.identity.tagline, tagline => update("identity", { ...kit.identity, tagline }), 200)}
        {field("Descriptor", kit.identity.descriptor, descriptor => update("identity", { ...kit.identity, descriptor }), 200)}
      </section>
      <section className="clay tile kit-wordmark"><span className="eyebrow">02 / Wordmark</span>
        <div className="kit-wordmark-sample" style={wordmarkStyle(kit)}>{kit.identity.name}</div><small>Text concept · not a final logo</small>
        {field("Wordmark treatment", kit.wordmark.treatment, treatment => update("wordmark", { ...kit.wordmark, treatment }), 200)}
        <div className="kit-selects">{(["casing", "tracking", "weight"] as const).map(key => <label key={key}>{key}
          <select disabled={locked} value={kit.wordmark[key]} onChange={e => update("wordmark", { ...kit.wordmark, [key]: e.target.value })}>
            {(key === "casing" ? ["lowercase", "uppercase", "titlecase", "mixed"] : key === "tracking" ? ["tight", "normal", "wide"] : ["regular", "medium", "semibold", "bold"]).map(v => <option key={v}>{v}</option>)}
          </select></label>)}</div>
      </section>
      <section className="clay tile kit-colors"><span className="eyebrow">03 / Colors</span><h2>Your palette</h2>
        {COLOR_ROLES.map(role => <label className="kit-color" key={role}><span className="color-swatch" style={{ background: kit.colors[role] }} />
          <span>{role}<input aria-label={`${role} HEX`} value={hexEdits[role] ?? kit.colors[role]} readOnly={locked} maxLength={7}
            aria-invalid={!validHex(hexEdits[role] ?? kit.colors[role])} onChange={e => {
              const value = e.target.value; setHexEdits(old => ({ ...old, [role]: value }));
              if (validHex(value)) update("colors", { ...kit.colors, [role]: value });
            }} /></span></label>)}
        {invalidHex && <p className="error" role="alert">Use #RRGGBB for every color. Invalid values are not saved.</p>}
      </section>
      <section className="clay tile kit-type"><span className="eyebrow">04 / Typography</span><h2>Type with purpose</h2>
        {field("Heading style", kit.typography.headingStyle, headingStyle => update("typography", { ...kit.typography, headingStyle }), 200)}
        {field("Body style", kit.typography.bodyStyle, bodyStyle => update("typography", { ...kit.typography, bodyStyle }), 200)}
        {field("Typography guidance", kit.typography.usageGuidance, usageGuidance => update("typography", { ...kit.typography, usageGuidance }))}
        <small>Preview uses the existing Manrope and DM Sans fonts.</small>
      </section>
      <section className="clay tile kit-voice"><span className="eyebrow">05 / Voice</span><h2>How you sound</h2>
        {field("Voice description", kit.voice.description, description => update("voice", { ...kit.voice, description }))}
        {(["traits", "preferredLanguage", "avoidedLanguage"] as const).map(key => <fieldset key={key}>
          <legend>{key === "traits" ? "Voice traits" : key === "preferredLanguage" ? "Preferred language" : "Avoided language"}</legend>
          {kit.voice[key].map((value, index) => <Field key={index} label={`${key === "traits" ? "Trait" : key === "preferredLanguage" ? "Preferred pattern" : "Avoided pattern"} ${index + 1}`}
            value={value} max={key === "traits" ? 80 : 200} locked={locked} onChange={text => update("voice", { ...kit.voice, [key]: kit.voice[key].map((v, i) => i === index ? text : v) })} />)}
        </fieldset>)}
      </section>
      <section className="clay tile kit-rules"><span className="eyebrow">06 / Brand rules</span><h2>The reference for your next words.</h2>
        <p>Review each rule. These structured rules will guide Brand Spellcheck after you confirm.</p>
        <div className="kit-rule-list">{kit.rules.map((rule, index) => <article className="kit-rule" key={rule.id}>
          <h3>{String(index + 1).padStart(2, "0")} / {rule.category}</h3>
          {field(`Rule ${index + 1}`, rule.rule, text => update("rules", kit.rules.map(r => r.id === rule.id ? { ...r, rule: text } : r)))}
          {field(`Rationale ${index + 1}`, rule.rationale, rationale => update("rules", kit.rules.map(r => r.id === rule.id ? { ...r, rationale } : r)))}
        </article>)}</div>
      </section>
      <section className="clay tile kit-imagery"><span className="eyebrow">07 / Imagery</span><h2>A visual world</h2>
        {field("Imagery style", kit.imagery.style, style => update("imagery", { ...kit.imagery, style }), 200)}
        {field("Imagery guidance", kit.imagery.guidance, guidance => update("imagery", { ...kit.imagery, guidance }))}
      </section>
      <BrandKitPreview kit={kit} />
    </div>
    <div className="clay tile kit-decision"><p>{locked ? "Brand Kit locked. Saved in this browser." : valid ? "Review your identity and rules, then lock this system." : "Complete every field and correct invalid values before confirming."}</p>
      <div className="tile-actions"><button className="btn btn-secondary" onClick={() => setModal("direction")}>Revisit direction</button>
        {locked ? <button className="btn btn-primary" onClick={() => { setHexEdits({}); dispatch({ type: "unlockBrandKit" }); }}>Edit brand kit</button> :
          <button className="btn btn-primary" disabled={!valid} onClick={() => setModal("confirm")}>Confirm brand kit →</button>}</div>
    </div>
    {modal === "confirm" && <ClayModal title="Confirm this brand system?" confirmLabel="Confirm brand kit" onCancel={() => setModal(null)}
      onConfirm={() => { setModal(null); if (valid) dispatch({ type: "confirmBrandKit", confirmedAt: new Date().toISOString() }); }}>
      <p>These rules will become the reference Aakaro uses to review your content.</p>
    </ClayModal>}
    {modal === "direction" && <ClayModal title="Revisit your direction?" confirmLabel="Unlock direction" onCancel={() => setModal(null)}
      onConfirm={() => { setModal(null); dispatch({ type: "unlockDirection" }); }}>
      <p>This clears the kit and its rules so you can build from your next confirmed direction.</p>
    </ClayModal>}
  </section>;
}
