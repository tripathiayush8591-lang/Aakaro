import { emptyBrandKitState, type AakaroProject, type BrandKit, type BrandKitState } from "../types/project";
import { validDirections } from "./directions";

export const COLOR_ROLES = ["primary", "secondary", "accent", "background"] as const;
export const validHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Drafts may be incomplete while typing; shape, bounds and colors remain safe to persist. */
export function validBrandKit(value: unknown, name: string, complete = true): value is BrandKit {
  if (!object(value)) return false;
  const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max && (!complete || !!v.trim());
  const fields = (v: unknown, keys: string[], max: number) => object(v) && keys.every(k => text(v[k], max));
  const list = (v: unknown, min: number, max: number, size: number) => Array.isArray(v) &&
    v.length >= (complete ? min : 0) && v.length <= max && v.every(t => text(t, size));
  const { identity: i, colors: c, typography: t, wordmark: w, imagery: m, voice: v, rules } = value;
  return object(i) && i.name === name && fields(i, ["tagline", "descriptor"], 200) &&
    object(c) && COLOR_ROLES.every(role => typeof c[role] === "string" && validHex(c[role])) &&
    fields(t, ["headingStyle", "bodyStyle"], 200) && fields(t, ["usageGuidance"], 400) &&
    object(w) && fields(w, ["treatment"], 200) &&
    ["lowercase", "uppercase", "titlecase", "mixed"].includes(String(w.casing)) &&
    ["tight", "normal", "wide"].includes(String(w.tracking)) &&
    ["regular", "medium", "semibold", "bold"].includes(String(w.weight)) &&
    fields(m, ["style"], 200) && fields(m, ["guidance"], 400) &&
    object(v) && fields(v, ["description"], 400) && list(v.traits, 3, 5, 80) &&
    list(v.preferredLanguage, 3, 6, 200) && list(v.avoidedLanguage, 3, 6, 200) &&
    Array.isArray(rules) && rules.length >= 6 && rules.length <= 10 &&
    rules.every((r, index) => object(r) && r.id === `rule${index + 1}` &&
      ["voice", "language", "messaging", "visual"].includes(String(r.category)) && fields(r, ["rule", "rationale"], 400));
}

export function kitFoundation(project: Pick<AakaroProject, "strategy" | "naming" | "directions">) {
  const { strategy, naming, directions } = project;
  if (!strategy.confirmed || naming.generationStatus !== "confirmed" || directions.status !== "confirmed" ||
    !directions.confirmedAt || !validDirections(directions.items, naming.selectedIds)) return null;
  const direction = directions.items.find(d => d.id === directions.selectedDirectionId);
  const candidate = naming.candidates.find(c => c.id === direction?.candidateId && naming.selectedIds.includes(c.id));
  return direction && candidate ? { strategy: strategy.confirmed, direction, candidate } : null;
}

export function parseBrandKit(value: unknown, name?: string): BrandKitState | null {
  if (value === undefined) return emptyBrandKitState();
  if (!object(value)) return null;
  if (!["idle", "generating", "editing", "ready", "confirmed"].includes(String(value.status))) return null;
  if (value.status === "idle" || value.status === "generating") {
    return value.draft === null && value.confirmed === null ? emptyBrandKitState() : null;
  }
  if (!name || !validBrandKit(value.draft, name, false) || typeof value.generatedAt !== "string") return null;
  if (value.status === "confirmed") {
    if (!validBrandKit(value.confirmed, name) || typeof value.confirmedAt !== "string" ||
      JSON.stringify(value.draft) !== JSON.stringify(value.confirmed)) return null;
    return { draft: value.draft, confirmed: value.confirmed, status: "confirmed", generatedAt: value.generatedAt, confirmedAt: value.confirmedAt };
  }
  if (value.confirmed !== null) return null;
  return { draft: value.draft, confirmed: null, status: "editing", generatedAt: value.generatedAt };
}
