import { kitFoundation, validBrandKit } from "./brandKit";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
  AakaroProject,
  BrandDirection,
  BrandKit,
  ClarificationQuestion,
  NamingCandidate,
  NamingEvaluation,
  StrategyBrief,
} from "../types/project";
import { emptyNamingState, emptyDirectionsState, emptyBrandKitState, emptySpellcheckState } from "../types/project";
import type { SpellcheckReviewRecord } from "../types/project";
import { CONTENT_MAX, validSpellcheckReview } from "./spellcheck";
import { validDirections } from "./directions";
import { loadProject, saveProject } from "./storage";

export function createProject(): AakaroProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    revision: 1,
    currentStage: "idea",
    idea: { rawIdea: "" },
    clarification: { questions: [], answers: [], completed: false },
    strategy: { draft: null, confirmed: null },
    naming: emptyNamingState(),
    directions: emptyDirectionsState(),
    brandKit: emptyBrandKitState(),
    spellcheck: emptySpellcheckState(),
  };
}

export type ProjectAction =
  | { type: "setIdea"; text: string }
  | { type: "enterClarification" }
  | { type: "backToIdea" }
  | { type: "clarifySuccess"; questions: ClarificationQuestion[]; expectedRevision: number }
  | { type: "setAnswer"; questionId: string; answer: string }
  | { type: "enterStrategy" }
  | { type: "strategySuccess"; draft: StrategyBrief; expectedRevision: number }
  | { type: "editStrategy"; draft: StrategyBrief }
  | { type: "reviseAnswers" }
  | { type: "confirmStrategy"; confirmedAt: string }
  | { type: "unlockStrategy" }
  | {
      type: "namingCandidatesSuccess";
      candidates: NamingCandidate[];
      generatedAt: string;
      expectedRevision: number;
    }
  | {
      type: "namingEvaluationSuccess";
      evaluations: NamingEvaluation[];
      expectedRevision: number;
    }
  | { type: "toggleShortlist"; candidateId: string }
  | { type: "confirmNaming"; confirmedAt: string }
  | { type: "backToNaming" }
  | { type: "unlockNaming" }
  | { type: "directionsStart"; expectedRevision: number }
  | { type: "directionsSuccess"; items: BrandDirection[]; generatedAt: string; expectedRevision: number }
  | { type: "directionsFailure"; expectedRevision: number }
  | { type: "selectDirection"; id: string }
  | { type: "confirmDirection"; confirmedAt: string }
  | { type: "unlockDirection" }
  | { type: "brandKitStart"; expectedRevision: number }
  | { type: "brandKitSuccess"; draft: BrandKit; expectedRevision: number; generatedAt: string }
  | { type: "brandKitFailure"; expectedRevision: number }
  | { type: "editBrandKit"; draft: BrandKit }
  | { type: "confirmBrandKit"; confirmedAt: string }
  | { type: "unlockBrandKit" }
  | { type: "backToDirections" }
  | { type: "continueToSpellcheck" }
  | { type: "backToBrandKit" }
  | { type: "spellcheckEditContent"; text: string }
  | { type: "spellcheckReviewStart"; expectedRevision: number }
  | {
      type: "spellcheckReviewSuccess";
      review: SpellcheckReviewRecord;
      expectedRevision: number;
    }
  | { type: "spellcheckReviewFailure"; expectedRevision: number }
  | { type: "spellcheckApplyFix"; issueId: string; nextContent: string }
  | { type: "spellcheckComplete"; confirmedAt: string }
  | { type: "spellcheckNewContent" }
  | { type: "reset" };

function commit(
  state: AakaroProject,
  patch: Partial<Omit<AakaroProject, "revision" | "updatedAt">>,
): AakaroProject {
  return {
    ...state,
    ...patch,
    revision: state.revision + 1,
    updatedAt: new Date().toISOString(),
  };
}

const clearedClarification = {
  questions: [],
  answers: [],
  completed: false,
};

export function projectReducer(
  state: AakaroProject,
  action: ProjectAction,
): AakaroProject {
  switch (action.type) {
    case "setIdea": {
      if (action.text === state.idea.rawIdea) return state;
      // Editing the idea invalidates everything downstream of it.
      return commit(state, {
        idea: { rawIdea: action.text },
        clarification: clearedClarification,
        strategy: { draft: null, confirmed: null },
        naming: emptyNamingState(),
        directions: emptyDirectionsState(),
        brandKit: emptyBrandKitState(),
        spellcheck: emptySpellcheckState(),
      });
    }
    case "enterClarification": {
      if (!state.idea.rawIdea.trim()) return state;
      return commit(state, { currentStage: "clarification" });
    }
    case "backToIdea":
      return commit(state, { currentStage: "idea" });
    case "clarifySuccess": {
      if (
        state.revision !== action.expectedRevision ||
        state.currentStage !== "clarification"
      )
        return state;
      return commit(state, {
        clarification: { ...state.clarification, questions: action.questions },
      });
    }
    case "setAnswer": {
      const others = state.clarification.answers.filter(
        (a) => a.questionId !== action.questionId,
      );
      const answers = [...others, { questionId: action.questionId, answer: action.answer }];
      const completed =
        state.clarification.questions.length > 0 &&
        state.clarification.questions.every(
          (q) =>
            answers.some((a) => a.questionId === q.id) &&
            answers.find((a) => a.questionId === q.id)!.answer.trim().length > 0,
        );
      return commit(state, {
        clarification: { ...state.clarification, answers, completed },
      });
    }
    case "enterStrategy": {
      if (!state.clarification.completed) return state;
      return commit(state, { currentStage: "strategy" });
    }
    case "strategySuccess": {
      if (
        state.revision !== action.expectedRevision ||
        state.currentStage !== "strategy"
      )
        return state;
      return commit(state, { strategy: { ...state.strategy, draft: action.draft } });
    }
    case "editStrategy": {
      if (state.currentStage !== "strategy") return state;
      return commit(state, {
        strategy: { ...state.strategy, draft: action.draft, confirmed: null },
        naming: emptyNamingState(),
        directions: emptyDirectionsState(),
        brandKit: emptyBrandKitState(),
        spellcheck: emptySpellcheckState(),
      });
    }
    case "reviseAnswers":
      return commit(state, {
        currentStage: "clarification",
        strategy: { draft: null, confirmed: null },
        naming: emptyNamingState(),
        directions: emptyDirectionsState(),
        brandKit: emptyBrandKitState(),
        spellcheck: emptySpellcheckState(),
      });
    case "confirmStrategy": {
      if (!state.strategy.draft) return state;
      return commit(state, {
        currentStage: "naming",
        strategy: {
          draft: state.strategy.draft,
          confirmed: state.strategy.draft,
          confirmedAt: action.confirmedAt,
        },
      });
    }
    case "unlockStrategy":
      return commit(state, {
        currentStage: "strategy",
        strategy: { draft: state.strategy.confirmed ?? state.strategy.draft, confirmed: null },
        // Naming depends entirely on the confirmed strategy, so it resets.
        naming: emptyNamingState(),
        directions: emptyDirectionsState(),
        brandKit: emptyBrandKitState(),
        spellcheck: emptySpellcheckState(),
      });
    case "namingCandidatesSuccess": {
      if (
        state.revision !== action.expectedRevision ||
        state.currentStage !== "naming" ||
        !state.strategy.confirmed
      )
        return state;
      // A fresh generation clears any stale selection from a previous run.
      return commit(state, {
        directions: emptyDirectionsState(),
        brandKit: emptyBrandKitState(),
        spellcheck: emptySpellcheckState(),
        naming: {
          candidates: action.candidates,
          evaluations: [],
          selectedIds: [],
          graveyardIds: [],
          generationStatus: "generated",
          generatedAt: action.generatedAt,
        },
      });
    }
    case "namingEvaluationSuccess": {
      if (
        state.revision !== action.expectedRevision ||
        state.currentStage !== "naming" ||
        state.naming.candidates.length !== 5 ||
        action.evaluations.length !== 5
      )
        return state;
      const candidateIds = new Set(state.naming.candidates.map((c) => c.id));
      if (
        !action.evaluations.every((e) => candidateIds.has(e.candidateId)) ||
        new Set(action.evaluations.map((e) => e.candidateId)).size !== 5
      )
        return state;
      return commit(state, {
        naming: {
          ...state.naming,
          evaluations: action.evaluations,
          generationStatus: "ready",
        },
      });
    }
    case "toggleShortlist": {
      const { naming } = state;
      if (
        naming.generationStatus !== "ready" ||
        !naming.candidates.some((c) => c.id === action.candidateId)
      )
        return state;
      const selectedIds = naming.selectedIds.includes(action.candidateId)
        ? naming.selectedIds.filter((id) => id !== action.candidateId)
        : naming.selectedIds.length < 2
          ? [...naming.selectedIds, action.candidateId]
          : naming.selectedIds;
      if (selectedIds === naming.selectedIds) return state;
      return commit(state, { naming: { ...naming, selectedIds }, directions: emptyDirectionsState(), brandKit: emptyBrandKitState(), spellcheck: emptySpellcheckState() });
    }
    case "confirmNaming": {
      const { naming } = state;
      if (
        state.currentStage !== "naming" ||
        naming.generationStatus !== "ready" ||
        naming.selectedIds.length !== 2
      )
        return state;
      const graveyardIds = naming.candidates
        .filter((c) => !naming.selectedIds.includes(c.id))
        .map((c) => c.id);
      return commit(state, {
        currentStage: "directions",
        naming: {
          ...naming,
          graveyardIds,
          generationStatus: "confirmed",
          confirmedAt: action.confirmedAt,
        },
      });
    }
    case "backToNaming":
      return commit(state, { currentStage: state.strategy.confirmed ? "naming" : "strategy" });
    case "unlockNaming":
      return commit(state, {
        currentStage: "naming",
        naming: { ...state.naming, generationStatus: "ready", graveyardIds: [], confirmedAt: undefined },
        directions: emptyDirectionsState(),
        brandKit: emptyBrandKitState(),
        spellcheck: emptySpellcheckState(),
      });
    case "directionsStart":
      if (state.revision !== action.expectedRevision || state.currentStage !== "directions" ||
        !state.strategy.confirmed || state.naming.generationStatus !== "confirmed" || state.directions.status !== "idle") return state;
      return commit(state, { directions: { ...emptyDirectionsState(), status: "generating" } });
    case "directionsSuccess":
      if (state.revision !== action.expectedRevision || state.currentStage !== "directions" ||
        !state.strategy.confirmed || state.naming.generationStatus !== "confirmed" || state.directions.status !== "generating" ||
        !validDirections(action.items, state.naming.selectedIds)) return state;
      return commit(state, { directions: {
        items: action.items, selectedDirectionId: null, status: "ready", generatedAt: action.generatedAt,
      } });
    case "directionsFailure":
      if (state.revision !== action.expectedRevision || state.directions.status !== "generating") return state;
      return commit(state, { directions: emptyDirectionsState(), brandKit: emptyBrandKitState(), spellcheck: emptySpellcheckState() });
    case "selectDirection":
      if (state.currentStage !== "directions" || state.directions.status !== "ready" ||
        !state.directions.items.some(d => d.id === action.id)) return state;
      return commit(state, { directions: { ...state.directions, selectedDirectionId: action.id }, brandKit: emptyBrandKitState(), spellcheck: emptySpellcheckState() });
    case "confirmDirection":
      if (state.currentStage !== "directions" || state.directions.status !== "ready" ||
        !state.strategy.confirmed || state.naming.generationStatus !== "confirmed" ||
        !validDirections(state.directions.items, state.naming.selectedIds) ||
        !state.directions.items.some(d => d.id === state.directions.selectedDirectionId)) return state;
      return commit(state, { currentStage: "brand-kit", directions: {
        ...state.directions, status: "confirmed", confirmedAt: action.confirmedAt,
      } });
    case "unlockDirection":
      // Direction unlock invalidates the kit and its confirmed rules.
      if (state.directions.status !== "confirmed") return state;
      return commit(state, { currentStage: "directions", brandKit: emptyBrandKitState(), spellcheck: emptySpellcheckState(), directions: {
        ...state.directions, status: "ready", confirmedAt: undefined,
      } });
    case "backToDirections":
      return commit(state, { currentStage: "directions" });
    case "brandKitStart":
      if (state.revision !== action.expectedRevision || state.currentStage !== "brand-kit" ||
        !kitFoundation(state) || state.brandKit.status !== "idle") return state;
      return commit(state, { brandKit: { ...emptyBrandKitState(), status: "generating" } });
    case "brandKitSuccess": {
      const foundation = kitFoundation(state);
      if (state.revision !== action.expectedRevision || state.currentStage !== "brand-kit" ||
        state.brandKit.status !== "generating" || !foundation || !validBrandKit(action.draft, foundation.candidate.name)) return state;
      if (!(["primary", "secondary", "accent", "background"] as const).every(role =>
        action.draft.colors[role] === foundation.direction.colors[role])) return state;
      return commit(state, { brandKit: { draft: action.draft, confirmed: null, status: "ready", generatedAt: action.generatedAt } });
    }
    case "brandKitFailure":
      if (state.revision !== action.expectedRevision || state.brandKit.status !== "generating") return state;
      return commit(state, { brandKit: emptyBrandKitState() });
    case "editBrandKit": {
      const foundation = kitFoundation(state);
      if (state.currentStage !== "brand-kit" || !["editing", "ready"].includes(state.brandKit.status) ||
        !foundation || !validBrandKit(action.draft, foundation.candidate.name, false)) return state;
      return commit(state, { brandKit: { ...state.brandKit, draft: action.draft, status: "editing", confirmed: null, confirmedAt: undefined } });
    }
    case "confirmBrandKit": {
      const foundation = kitFoundation(state);
      if (state.currentStage !== "brand-kit" || !["editing", "ready"].includes(state.brandKit.status) ||
        !foundation || !validBrandKit(state.brandKit.draft, foundation.candidate.name)) return state;
      return commit(state, { currentStage: "spellcheck", spellcheck: emptySpellcheckState(), brandKit: { ...state.brandKit,
        confirmed: structuredClone(state.brandKit.draft), status: "confirmed", confirmedAt: action.confirmedAt } });
    }
    case "unlockBrandKit":
      if (state.brandKit.status !== "confirmed" || !state.brandKit.confirmed) return state;
      // Edited rules invalidate every spellcheck finding tied to the old kit.
      return commit(state, { currentStage: "brand-kit", spellcheck: emptySpellcheckState(), brandKit: { ...state.brandKit,
        draft: structuredClone(state.brandKit.confirmed), confirmed: null, confirmedAt: undefined, status: "editing" } });
    case "continueToSpellcheck":
      if (state.brandKit.status !== "confirmed" || !state.brandKit.confirmed) return state;
      return commit(state, { currentStage: "spellcheck" });
    case "backToBrandKit":
      // Navigation only: the confirmed kit is untouched, so spellcheck state stays.
      if (state.brandKit.status !== "confirmed") return state;
      return commit(state, { currentStage: "brand-kit" });
    case "spellcheckEditContent": {
      const spellcheck = state.spellcheck;
      if (state.currentStage !== "spellcheck" || !state.brandKit.confirmed ||
        (spellcheck.status !== "idle" && spellcheck.status !== "ready" && spellcheck.status !== "reviewing") ||
        action.text.length > CONTENT_MAX ||
        (spellcheck.status === "idle" && !action.text.trim()) ||
        (spellcheck.status !== "idle" && action.text === spellcheck.workingContent))
        return state;
      // The first paste records the untouched original; every later edit moves
      // only the working copy and marks any existing review stale.
      return commit(state, {
        spellcheck: {
          originalContent: spellcheck.status === "idle" ? action.text : spellcheck.originalContent,
          workingContent: action.text,
          review: spellcheck.review ? { ...spellcheck.review, stale: true } : null,
          status: "ready",
          contentRevision: spellcheck.contentRevision + 1,
        },
      });
    }
    case "spellcheckReviewStart": {
      const spellcheck = state.spellcheck;
      if (state.revision !== action.expectedRevision || state.currentStage !== "spellcheck" ||
        !state.brandKit.confirmed || spellcheck.status !== "ready" ||
        !spellcheck.workingContent.trim())
        return state;
      return commit(state, { spellcheck: { ...spellcheck, status: "reviewing" } });
    }
    case "spellcheckReviewSuccess": {
      const kit = state.brandKit.confirmed;
      const spellcheck = state.spellcheck;
      // Commits only while still reviewing, at the revision the request left
      // behind, and when every quote still grounds in the working content —
      // edits made during the request make the response a discarded no-op.
      if (state.revision !== action.expectedRevision || state.currentStage !== "spellcheck" ||
        !kit || spellcheck.status !== "reviewing" ||
        !validSpellcheckReview(action.review, kit, spellcheck.workingContent))
        return state;
      return commit(state, {
        spellcheck: { ...spellcheck, review: { ...action.review, stale: false }, status: "ready" },
      });
    }
    case "spellcheckReviewFailure":
      if (state.revision !== action.expectedRevision || state.spellcheck.status !== "reviewing")
        return state;
      return commit(state, { spellcheck: { ...state.spellcheck, status: "ready" } });
    case "spellcheckApplyFix": {
      const spellcheck = state.spellcheck;
      if (state.currentStage !== "spellcheck" || !state.brandKit.confirmed ||
        spellcheck.status !== "ready" || !spellcheck.review ||
        !spellcheck.review.issues.some((issue) => issue.id === action.issueId) ||
        action.nextContent.length > CONTENT_MAX ||
        action.nextContent === spellcheck.workingContent)
        return state;
      // Only the working copy moves; the original paste is never rewritten and
      // the review goes stale so the next check validates the fixed content.
      return commit(state, {
        spellcheck: {
          ...spellcheck,
          workingContent: action.nextContent,
          contentRevision: spellcheck.contentRevision + 1,
          review: { ...spellcheck.review, stale: true },
        },
      });
    }
    case "spellcheckComplete": {
      const spellcheck = state.spellcheck;
      if (state.currentStage !== "spellcheck" || spellcheck.status !== "ready" ||
        !spellcheck.workingContent.trim() || !spellcheck.review || spellcheck.review.stale)
        return state;
      return commit(state, {
        spellcheck: { ...spellcheck, status: "complete", confirmedAt: action.confirmedAt },
      });
    }
    case "spellcheckNewContent":
      if (state.currentStage !== "spellcheck" || !state.brandKit.confirmed) return state;
      return commit(state, { spellcheck: emptySpellcheckState() });
    case "reset":
      return createProject();
    default:
      return state;
  }
}

export interface ProjectStore {
  project: AakaroProject;
  dispatch: React.Dispatch<ProjectAction>;
  storageWarning: string | null;
  resetProject: () => void;
}

/**
 * One canonical project per session id, hydrated from localStorage and saved
 * on every committed change.
 */
export function useAakaroProject(uid: string): ProjectStore {
  const initial = useMemo(() => loadProject(uid), [uid]);
  const [project, dispatch] = useReducer(
    projectReducer,
    undefined,
    () => initial.project ?? createProject(),
  );
  const warnedAboutCorrupt = useRef(false);
  if (initial.corrupted && !warnedAboutCorrupt.current) warnedAboutCorrupt.current = true;
  const [storageWarning, setStorageWarning] = useState<string | null>(
    initial.corrupted
      ? "We found a saved project but couldn't restore it safely. A backup was kept in this browser, so you're starting fresh."
      : null,
  );
  useEffect(() => {
    const warning = saveProject(uid, project);
    if (warning) setStorageWarning(warning);
    else setStorageWarning((current) => (current?.startsWith("Your latest change") ? null : current));
  }, [uid, project]);
  return {
    project,
    dispatch,
    storageWarning,
    resetProject: () => dispatch({ type: "reset" }),
  };
}
