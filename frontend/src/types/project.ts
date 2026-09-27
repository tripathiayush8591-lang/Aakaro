/** Canonical Aakaro project state, shared by the wizard, persistence, and export. */

export type ProjectStage =
  | "idea"
  | "clarification"
  | "strategy"
  | "naming"
  | "directions"
  | "brand-kit"
  | "spellcheck"
  | "export";

export interface ClarificationQuestion {
  id: string;
  question: string;
  reason: string;
}

export interface ClarificationAnswer {
  questionId: string;
  answer: string;
}

export interface StrategyAudience {
  primary: string;
  description: string;
}

export interface StrategyBrief {
  oneLiner: string;
  audience: StrategyAudience;
  problem: string;
  promise: string;
  differentiation: string;
  personality: string[];
  positioning: string;
  namingTerritories: string[];
}

export interface NamingCandidate {
  id: string;
  name: string;
  rationale: string;
  territory: string;
  linguisticNote?: string;
}

export interface NamingScores {
  distinctiveness: number;
  strategicFit: number;
  memorability: number;
  extensibility: number;
}

export interface NamingEvaluation {
  candidateId: string;
  scores: NamingScores;
  strengths: string[];
  risks: string[];
  verdict: string;
}

/**
 * The naming domain: five generated candidates, their separate evaluation,
 * the user's two-name shortlist, and the three rejected names in the Graveyard.
 * "generating"/"evaluating" are in-flight-only and never persisted.
 */
export type NamingGenerationStatus =
  | "idle"
  | "generating"
  | "generated"
  | "evaluating"
  | "ready"
  | "confirmed";

export interface NamingState {
  candidates: NamingCandidate[];
  evaluations: NamingEvaluation[];
  selectedIds: string[];
  graveyardIds: string[];
  generationStatus: NamingGenerationStatus;
  generatedAt?: string;
  confirmedAt?: string;
}

export function emptyNamingState(): NamingState {
  return {
    candidates: [],
    evaluations: [],
    selectedIds: [],
    graveyardIds: [],
    generationStatus: "idle",
  };
}

export interface AakaroProject {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  updatedAt: string;
  /** Bumped on every committed change; in-flight AI results must match it. */
  revision: number;
  currentStage: ProjectStage;
  idea: { rawIdea: string };
  clarification: {
    questions: ClarificationQuestion[];
    answers: ClarificationAnswer[];
    completed: boolean;
  };
  strategy: {
    draft: StrategyBrief | null;
    confirmed: StrategyBrief | null;
    confirmedAt?: string;
  };
  naming: NamingState;
  directions: DirectionsState;
  brandKit: BrandKitState;
  spellcheck: SpellcheckState;
}

export interface BrandDirection {
  id: "direction1" | "direction2";
  candidateId: string;
  conceptName: string;
  conceptStatement: string;
  personality: string[];
  colors: { primary: string; secondary: string; accent: string; background: string; rationale: string };
  typography: { headingStyle: string; bodyStyle: string; rationale: string };
  logoApproach: { approach: string; rationale: string };
  imagery: { style: string; rationale: string };
  voice: { traits: string[]; sampleLine: string };
}

export interface DirectionsState {
  items: BrandDirection[];
  selectedDirectionId: string | null;
  status: "idle" | "generating" | "ready" | "confirmed";
  generatedAt?: string;
  confirmedAt?: string;
}

export function emptyDirectionsState(): DirectionsState {
  return { items: [], selectedDirectionId: null, status: "idle" };
}

/** The five visible steps of the guided journey, shown in the stage rail. */
export const STAGE_STEPS = [
  { id: "idea", label: "Idea" },
  { id: "clarification", label: "Clarify" },
  { id: "strategy", label: "Strategy" },
  { id: "naming", label: "Naming" },
  { id: "identity", label: "Identity" },
] as const;

export type StageStepId = (typeof STAGE_STEPS)[number]["id"];

/** Maps the fine-grained project stages onto the five visible rail steps. */
export function stageStep(stage: ProjectStage): StageStepId {
  switch (stage) {
    case "idea":
      return "idea";
    case "clarification":
      return "clarification";
    case "strategy":
      return "strategy";
    case "naming":
      return "naming";
    default:
      return "identity";
  }
}

export interface BrandRule {
  id: string;
  category: "voice" | "language" | "messaging" | "visual";
  rule: string;
  rationale: string;
}
export interface BrandKit {
  identity: { name: string; tagline: string; descriptor: string };
  colors: { primary: string; secondary: string; accent: string; background: string };
  typography: { headingStyle: string; bodyStyle: string; usageGuidance: string };
  wordmark: {
    treatment: string;
    casing: "lowercase" | "uppercase" | "titlecase" | "mixed";
    tracking: "tight" | "normal" | "wide";
    weight: "regular" | "medium" | "semibold" | "bold";
  };
  imagery: { style: string; guidance: string };
  voice: { traits: string[]; description: string; preferredLanguage: string[]; avoidedLanguage: string[] };
  rules: BrandRule[];
}
export interface BrandKitState {
  draft: BrandKit | null;
  confirmed: BrandKit | null;
  status: "idle" | "generating" | "editing" | "ready" | "confirmed";
  generatedAt?: string;
  confirmedAt?: string;
}
export function emptyBrandKitState(): BrandKitState {
  return { draft: null, confirmed: null, status: "idle" };
}

/** Phase 6 — Brand Spellcheck: rule-linked review of pasted content. */

export interface SpellcheckIssue {
  id: string;
  source: "deterministic" | "ai";
  ruleId: string;
  severity: "low" | "medium" | "high";
  category: "voice" | "language" | "messaging" | "visual" | "consistency";
  originalText: string;
  start?: number;
  end?: number;
  explanation: string;
  suggestion: string;
  replacement?: string;
}

export interface SpellcheckReview {
  summary: string;
  issues: SpellcheckIssue[];
  passedRuleIds: string[];
  aiReviewed: boolean;
  reviewedAt: string;
}

/** The stored review additionally tracks whether the content changed since. */
export interface SpellcheckReviewRecord extends SpellcheckReview {
  stale: boolean;
}

export type SpellcheckStatus = "idle" | "reviewing" | "ready" | "complete";

export interface SpellcheckState {
  /** The content exactly as first pasted; never rewritten by fixes. */
  originalContent: string;
  /** The editable copy the user works on. */
  workingContent: string;
  review: SpellcheckReviewRecord | null;
  status: SpellcheckStatus;
  contentRevision: number;
  confirmedAt?: string;
}

export function emptySpellcheckState(): SpellcheckState {
  return {
    originalContent: "",
    workingContent: "",
    review: null,
    status: "idle",
    contentRevision: 0,
  };
}
