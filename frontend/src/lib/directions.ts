import type { BrandDirection, DirectionsState, NamingState } from "../types/project";
import { emptyDirectionsState } from "../types/project";

const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;
const strings = (v: unknown, min: number, max: number) => Array.isArray(v) && v.length >= min && v.length <= max && v.every(s => text(s, 80));

/** Shared validation for transport, reducer commits and browser restoration. */
export function validDirections(value: unknown, candidateIds: string[]): value is BrandDirection[] {
  if (!Array.isArray(value) || value.length !== 2 || new Set(candidateIds).size !== 2) return false;
  return ["direction1", "direction2"].every((id, index) => {
    const d: unknown = value.find(v => object(v) && v.id === id);
    if (!object(d) || d.candidateId !== candidateIds[index] || !text(d.conceptName, 80) ||
      !text(d.conceptStatement, 400) || !strings(d.personality, 2, 4)) return false;
    const { colors: c, typography: t, logoApproach: l, imagery: i, voice: v } = d;
    return object(c) && [c.primary, c.secondary, c.accent, c.background].every(h => typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h)) && text(c.rationale, 400) &&
      object(t) && text(t.headingStyle, 200) && text(t.bodyStyle, 200) && text(t.rationale, 400) &&
      object(l) && text(l.approach, 200) && text(l.rationale, 400) &&
      object(i) && text(i.style, 200) && text(i.rationale, 400) &&
      object(v) && strings(v.traits, 3, 5) && text(v.sampleLine, 160);
  });
}

export function parseDirections(value: unknown, naming: NamingState): DirectionsState | null {
  if (value === undefined) return emptyDirectionsState(); // Phase 3 migration.
  if (!object(value)) return null;
  const { status, items, selectedDirectionId, generatedAt, confirmedAt } = value;
  if (status === "idle" || status === "generating") {
    if (!Array.isArray(items) || items.length || selectedDirectionId !== null) return null;
    return emptyDirectionsState(); // Interrupted requests are explicitly retryable.
  }
  if ((status !== "ready" && status !== "confirmed") || naming.generationStatus !== "confirmed" ||
    !validDirections(items, naming.selectedIds) || !text(generatedAt, 80) ||
    (selectedDirectionId !== null && !items.some(d => d.id === selectedDirectionId))) return null;
  if (status === "confirmed" && (selectedDirectionId === null || !text(confirmedAt, 80))) return null;
  return { items, selectedDirectionId: selectedDirectionId as string | null, status, generatedAt,
    ...(status === "confirmed" ? { confirmedAt: confirmedAt as string } : {}) };
}
