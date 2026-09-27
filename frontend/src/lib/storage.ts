import type {
  AakaroProject,
  NamingCandidate,
  NamingEvaluation,
  NamingState,
  StrategyBrief,
} from "../types/project";
import { emptyNamingState } from "../types/project";

/**
 * Browser-local persistence for the single active project, namespaced per
 * session id. Local saving is not cloud backup. Loaded data is validated;
 * corrupt payloads are backed up, never silently deleted.
 */

const KEY_PREFIX = "aakaro:v1:";
const KEY_SUFFIX = ":active-project";
const CORRUPT_SUFFIX = ":corrupt-backup";

export const projectKey = (uid: string) => `${KEY_PREFIX}${uid}${KEY_SUFFIX}`;

function isNonEmptyString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

function parseBrief(value: unknown): StrategyBrief | null {
  if (typeof value !== "object" || value === null) return null;
  const brief = value as Record<string, unknown>;
  const audience =
    typeof brief.audience === "object" && brief.audience !== null
      ? (brief.audience as Record<string, unknown>)
      : null;
  const text = (v: unknown, max: number) => isNonEmptyString(v, max);
  const strings = (v: unknown, min: number, max: number, itemMax: number) =>
    Array.isArray(v) &&
    v.length >= min &&
    v.length <= max &&
    v.every((item) => isNonEmptyString(item, itemMax));
  if (
    !audience ||
    !text(brief.oneLiner, 240) ||
    !text(audience.primary, 160) ||
    !text(audience.description, 800) ||
    !text(brief.problem, 800) ||
    !text(brief.promise, 800) ||
    !text(brief.differentiation, 800) ||
    !text(brief.positioning, 800) ||
    !strings(brief.personality, 3, 3, 60) ||
    !strings(brief.namingTerritories, 2, 4, 80)
  )
    return null;
  return {
    oneLiner: brief.oneLiner,
    audience: { primary: audience.primary, description: audience.description },
    problem: brief.problem,
    promise: brief.promise,
    differentiation: brief.differentiation,
    personality: brief.personality,
    positioning: brief.positioning,
    namingTerritories: brief.namingTerritories,
  } as StrategyBrief;
}

const STAGES = new Set([
  "idea",
  "clarification",
  "strategy",
  "naming",
  "directions",
  "brand-kit",
  "spellcheck",
  "export",
]);

const PERSISTED_NAMING_STATUSES = new Set(["idle", "generated", "ready", "confirmed"]);

function parseCandidate(value: unknown): NamingCandidate | null {
  if (typeof value !== "object" || value === null) return null;
  const c = value as Record<string, unknown>;
  if (
    !isNonEmptyString(c.id, 80) ||
    !isNonEmptyString(c.name, 40) ||
    !isNonEmptyString(c.rationale, 300) ||
    !isNonEmptyString(c.territory, 80)
  )
    return null;
  const note =
    c.linguisticNote === undefined || c.linguisticNote === null
      ? undefined
      : isNonEmptyString(c.linguisticNote, 200)
        ? c.linguisticNote
        : null;
  if (note === null) return null;
  return {
    id: c.id,
    name: c.name,
    rationale: c.rationale,
    territory: c.territory,
    ...(note !== undefined ? { linguisticNote: note } : {}),
  };
}

function parseEvaluation(
  value: unknown,
  candidateIds: Set<string>,
): NamingEvaluation | null {
  if (typeof value !== "object" || value === null) return null;
  const e = value as Record<string, unknown>;
  const score = (v: unknown): v is number =>
    typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
  const points = (v: unknown) =>
    Array.isArray(v) &&
    v.length >= 1 &&
    v.length <= 3 &&
    v.every((item) => isNonEmptyString(item, 120));
  if (
    typeof e.scores !== "object" ||
    e.scores === null ||
    !isNonEmptyString(e.candidateId, 80) ||
    !candidateIds.has(e.candidateId) ||
    !points(e.strengths) ||
    !points(e.risks) ||
    !isNonEmptyString(e.verdict, 300)
  )
    return null;
  const s = e.scores as Record<string, unknown>;
  if (
    !score(s.distinctiveness) ||
    !score(s.strategicFit) ||
    !score(s.memorability) ||
    !score(s.extensibility)
  )
    return null;
  return {
    candidateId: e.candidateId,
    scores: {
      distinctiveness: s.distinctiveness,
      strategicFit: s.strategicFit,
      memorability: s.memorability,
      extensibility: s.extensibility,
    },
    strengths: e.strengths as string[],
    risks: e.risks as string[],
    verdict: e.verdict,
  };
}

/**
 * Accepts only naming states the app can actually produce. A missing block
 * defaults to empty so pre-naming projects keep loading. Transient in-flight
 * statuses are normalized to their last committed state (interrupted work
 * becomes retryable, never stuck loading).
 */
function parseNaming(value: unknown): NamingState | null {
  if (value === undefined || value === null) return emptyNamingState();
  if (typeof value !== "object") return null;
  const n = value as Record<string, unknown>;
  const rawStatus = typeof n.generationStatus === "string" ? n.generationStatus : "";
  const status =
    rawStatus === "generating"
      ? "idle"
      : rawStatus === "evaluating"
        ? "generated"
        : rawStatus;
  if (!PERSISTED_NAMING_STATUSES.has(status)) return null;

  const candidateList = Array.isArray(n.candidates) ? n.candidates : null;
  if (!candidateList) return null;
  const candidates = candidateList.map(parseCandidate);
  if (candidates.some((c) => c === null)) return null;
  const validCandidates = candidates as NamingCandidate[];
  const ids = validCandidates.map((c) => c.id);
  const idSet = new Set(ids);
  if (status === "idle") {
    if (validCandidates.length !== 0) return null;
    return emptyNamingState();
  }
  if (
    validCandidates.length !== 5 ||
    idSet.size !== 5 ||
    new Set(validCandidates.map((c) => c.name.toLowerCase())).size !== 5 ||
    typeof n.generatedAt !== "string"
  )
    return null;

  const selected = Array.isArray(n.selectedIds) ? n.selectedIds : null;
  if (
    !selected ||
    selected.some((id) => typeof id !== "string" || !idSet.has(id as string))
  )
    return null;
  const graveyard = Array.isArray(n.graveyardIds) ? n.graveyardIds : null;
  const validGraveyard =
    graveyard &&
    graveyard.every((id) => typeof id === "string" && idSet.has(id as string))
      ? (graveyard as string[])
      : null;
  if (!validGraveyard) return null;

  if (status === "generated") {
    if (n.evaluations !== undefined && (n.evaluations as unknown[]).length !== 0)
      return null;
    if (selected.length !== 0 || validGraveyard.length !== 0) return null;
    return {
      candidates: validCandidates,
      evaluations: [],
      selectedIds: [],
      graveyardIds: [],
      generationStatus: "generated",
      generatedAt: n.generatedAt,
    };
  }

  // ready | confirmed: five evaluations covering exactly the candidate ids.
  if (!Array.isArray(n.evaluations) || n.evaluations.length !== 5) return null;
  const evaluations = n.evaluations.map((e) => parseEvaluation(e, idSet));
  if (evaluations.some((e) => e === null)) return null;
  const validEvaluations = evaluations as NamingEvaluation[];
  if (new Set(validEvaluations.map((e) => e.candidateId)).size !== 5) return null;

  if (status === "ready") {
    if (selected.length > 2 || validGraveyard.length !== 0) return null;
    return {
      candidates: validCandidates,
      evaluations: validEvaluations,
      selectedIds: selected as string[],
      graveyardIds: [],
      generationStatus: "ready",
      generatedAt: n.generatedAt,
    };
  }

  // confirmed: exactly two shortlisted and the disjoint three in the Graveyard.
  if (typeof n.confirmedAt !== "string" || selected.length !== 2) return null;
  if (
    validGraveyard.length !== 3 ||
    new Set([...(selected as string[]), ...validGraveyard]).size !== 5
  )
    return null;
  return {
    candidates: validCandidates,
    evaluations: validEvaluations,
    selectedIds: selected as string[],
    graveyardIds: validGraveyard,
    generationStatus: "confirmed",
    generatedAt: n.generatedAt,
    confirmedAt: n.confirmedAt,
  };
}

/** Tolerant validator: accepts only well-formed projects, null otherwise. */
export function parseProject(value: unknown): AakaroProject | null {
  if (typeof value !== "object" || value === null) return null;
  const p = value as Record<string, unknown>;
  const idea =
    typeof p.idea === "object" && p.idea !== null
      ? (p.idea as Record<string, unknown>)
      : null;
  const clarification =
    typeof p.clarification === "object" && p.clarification !== null
      ? (p.clarification as Record<string, unknown>)
      : null;
  const strategy =
    typeof p.strategy === "object" && p.strategy !== null
      ? (p.strategy as Record<string, unknown>)
      : null;
  if (
    p.schemaVersion !== 1 ||
    typeof p.id !== "string" ||
    !p.id ||
    typeof p.createdAt !== "string" ||
    typeof p.updatedAt !== "string" ||
    typeof p.revision !== "number" ||
    typeof p.currentStage !== "string" ||
    !STAGES.has(p.currentStage) ||
    !idea ||
    typeof idea.rawIdea !== "string" ||
    idea.rawIdea.length > 1000 ||
    !clarification ||
    !Array.isArray(clarification.questions) ||
    !Array.isArray(clarification.answers) ||
    !clarification.questions.every(
      (q) =>
        typeof q === "object" &&
        q !== null &&
        isNonEmptyString((q as Record<string, unknown>).id, 80) &&
        isNonEmptyString((q as Record<string, unknown>).question, 300) &&
        isNonEmptyString((q as Record<string, unknown>).reason, 300),
    ) ||
    !clarification.answers.every(
      (a) =>
        typeof a === "object" &&
        a !== null &&
        isNonEmptyString((a as Record<string, unknown>).questionId, 80) &&
        typeof (a as Record<string, unknown>).answer === "string" &&
        ((a as Record<string, unknown>).answer as string).length <= 1200,
    ) ||
    !strategy
  )
    return null;
  const draft = strategy.draft === null ? null : parseBrief(strategy.draft);
  const confirmed = strategy.confirmed === null ? null : parseBrief(strategy.confirmed);
  // A half-valid strategy block (e.g. valid draft, malformed confirmed) is
  // rejected as a whole so restoration never shows mixed state.
  if (strategy.draft !== null && !draft) return null;
  if (strategy.confirmed !== null && !confirmed) return null;
  if (strategy.confirmedAt !== undefined && typeof strategy.confirmedAt !== "string")
    return null;
  const naming = parseNaming(p.naming);
  if (!naming) return null;
  return {
    schemaVersion: 1,
    id: p.id,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    revision: p.revision,
    currentStage: p.currentStage as AakaroProject["currentStage"],
    idea: { rawIdea: idea.rawIdea },
    clarification: {
      questions: clarification.questions as AakaroProject["clarification"]["questions"],
      answers: clarification.answers as AakaroProject["clarification"]["answers"],
      completed:
        clarification.questions.length > 0 &&
        clarification.questions.every((q) =>
          (clarification.answers as AakaroProject["clarification"]["answers"]).some(
            (a) => a.questionId === (q as { id: string }).id && a.answer.trim(),
          ),
        ),
    },
    strategy: {
      draft,
      confirmed,
      ...(typeof strategy.confirmedAt === "string"
        ? { confirmedAt: strategy.confirmedAt }
        : {}),
    },
    naming,
  };
}

export interface LoadResult {
  project: AakaroProject | null;
  /** True when a saved payload existed but could not be restored safely. */
  corrupted: boolean;
}

export function loadProject(uid: string): LoadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(projectKey(uid));
  } catch {
    return { project: null, corrupted: false };
  }
  if (!raw) return { project: null, corrupted: false };
  try {
    const project = parseProject(JSON.parse(raw) as unknown);
    if (project) return { project, corrupted: false };
  } catch {
    // Fall through to the corrupt-payload path.
  }
  try {
    localStorage.setItem(`${projectKey(uid)}${CORRUPT_SUFFIX}`, raw);
  } catch {
    // Keep the original untouched if even the backup cannot be written.
  }
  return { project: null, corrupted: true };
}

/** Returns a user-facing warning when the save could not be written. */
export function saveProject(uid: string, project: AakaroProject): string | null {
  try {
    localStorage.setItem(projectKey(uid), JSON.stringify(project));
    return null;
  } catch {
    return "Your latest change could not be saved in this browser. Copy anything important before continuing.";
  }
}

export function clearProject(uid: string): void {
  try {
    localStorage.removeItem(projectKey(uid));
  } catch {
    // Nothing to recover; a failed clear leaves the old project readable.
  }
}
