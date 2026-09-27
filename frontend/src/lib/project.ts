import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type {
  AakaroProject,
  ClarificationQuestion,
  NamingCandidate,
  NamingEvaluation,
  StrategyBrief,
} from "../types/project";
import { emptyNamingState } from "../types/project";
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
      });
    }
    case "reviseAnswers":
      return commit(state, {
        currentStage: "clarification",
        strategy: { draft: null, confirmed: null },
        naming: emptyNamingState(),
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
      return commit(state, { naming: { ...naming, selectedIds } });
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
