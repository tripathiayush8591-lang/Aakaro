import { COLOR_ROLES, validBrandKit } from "./brandKit";
import type { BrandKit } from "../types/project";
import { validDirections } from "./directions";
import type { User } from "firebase/auth";
import { auth } from "./firebase";
import type { ApiFailure, ConnectionResult, Success } from "../types/api";
import type {
  BrandDirection,
  ClarificationQuestion,
  NamingCandidate,
  NamingEvaluation,
  SpellcheckReview,
  StrategyBrief,
} from "../types/project";
import { validSpellcheckReview } from "./spellcheck";

export class ApiError extends Error {
  constructor(
    public detail: ApiFailure,
    public requestId?: string,
  ) {
    super(detail.message);
  }
}
function baseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    return value.replace(/\/$/, "");
  } catch {
    throw new ApiError({
      code: "CONFIGURATION_ERROR",
      message:
        "The API address is not configured. Set VITE_API_BASE_URL and restart the frontend.",
      retryable: false,
    });
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function request(
  path: string,
  user: User | null,
  signal: AbortSignal,
  body?: object,
): Promise<Success<unknown>> {
  const requestId = crypto.randomUUID();
  const headers: Record<string, string> = { "X-Request-ID": requestId };
  try {
    if (user) {
      const token = await user.getIdToken();
      if (auth?.currentUser !== user || signal.aborted)
        throw new DOMException("Session changed", "AbortError");
      headers.Authorization = `Bearer ${token}`;
    }
    if (body) headers["Content-Type"] = "application/json";
    const response = await fetch(`${baseUrl()}${path}`, {
      method: body ? "POST" : "GET",
      headers,
      signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]),
      body: body ? JSON.stringify({ ...body, requestId }) : undefined,
    });
    const payload: unknown = await response.json();
    if (user && (auth?.currentUser !== user || signal.aborted)) {
      throw new DOMException("Session changed", "AbortError");
    }
    if (
      object(payload) &&
      object(payload.error) &&
      typeof payload.error.message === "string" &&
      typeof payload.error.code === "string" &&
      typeof payload.error.retryable === "boolean"
    ) {
      throw new ApiError(
        {
          code: payload.error.code,
          message: payload.error.message,
          retryable: payload.error.retryable,
        },
        typeof payload.requestId === "string" ? payload.requestId : requestId,
      );
    }
    if (
      !response.ok ||
      !object(payload) ||
      typeof payload.requestId !== "string" ||
      !("data" in payload)
    )
      throw new Error("Invalid response");
    return { requestId: payload.requestId, data: payload.data };
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      {
        code: "NETWORK_ERROR",
        message:
          "Could not complete the request. Check your connection and that the backend is running, then retry.",
        retryable: true,
      },
      requestId,
    );
  }
}
export async function checkHealth(signal: AbortSignal) {
  const result = await request("/health", null, signal);
  if (!object(result.data) || result.data.status !== "ok")
    throw new Error("Unexpected health response");
}
export async function testConnection(
  idea: string,
  user: User,
  signal: AbortSignal,
): Promise<Success<ConnectionResult>> {
  const result = await request("/api/connection-test", user, signal, {
    idea: idea.trim(),
  });
  const data = result.data;
  if (
    !object(data) ||
    !["summary", "possibleAudience", "clarifyingQuestion"].every(
      (key) =>
        typeof data[key] === "string" &&
        (data[key] as string).trim().length > 0 &&
        (data[key] as string).length <= 1200,
    )
  ) {
    throw new ApiError(
      {
        code: "INVALID_RESPONSE",
        message: "The server returned an unexpected response. Try again.",
        retryable: true,
      },
      result.requestId,
    );
  }
  return {
    requestId: result.requestId,
    data: data as unknown as ConnectionResult,
  };
}

function boundedText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= max
  );
}

const invalidAIResponse: ApiFailure = {
  code: "INVALID_RESPONSE",
  message: "The AI response was incomplete. Try again.",
  retryable: true,
};

export async function clarifyIdea(
  idea: string,
  user: User | null,
  signal: AbortSignal,
): Promise<ClarificationQuestion[]> {
  const result = await request("/api/idea/clarify", user, signal, {
    idea: idea.trim(),
  });
  const data = result.data;
  const questions =
    object(data) && Array.isArray(data.questions) ? data.questions : null;
  if (
    !questions ||
    questions.length !== 3 ||
    !questions.every(
      (q) =>
        object(q) &&
        boundedText(q.id, 80) &&
        boundedText(q.question, 300) &&
        boundedText(q.reason, 300),
    )
  ) {
    throw new ApiError(invalidAIResponse, result.requestId);
  }
  return questions as unknown as ClarificationQuestion[];
}

function parseBrief(value: unknown): StrategyBrief | null {
  if (!object(value)) return null;
  const audience =
    object(value.audience) &&
    boundedText(value.audience.primary, 160) &&
    boundedText(value.audience.description, 800)
      ? { primary: value.audience.primary, description: value.audience.description }
      : null;
  const list = (v: unknown, min: number, max: number, itemMax: number) =>
    Array.isArray(v) &&
    v.length >= min &&
    v.length <= max &&
    v.every((item) => boundedText(item, itemMax));
  if (
    !audience ||
    !boundedText(value.oneLiner, 240) ||
    !boundedText(value.problem, 800) ||
    !boundedText(value.promise, 800) ||
    !boundedText(value.differentiation, 800) ||
    !boundedText(value.positioning, 800) ||
    !list(value.personality, 3, 3, 60) ||
    !list(value.namingTerritories, 2, 4, 80)
  )
    return null;
  return {
    oneLiner: value.oneLiner,
    audience,
    problem: value.problem,
    promise: value.promise,
    differentiation: value.differentiation,
    personality: value.personality as string[],
    positioning: value.positioning,
    namingTerritories: value.namingTerritories as string[],
  };
}

export async function generateStrategy(
  idea: string,
  clarifications: { question: string; answer: string }[],
  user: User | null,
  signal: AbortSignal,
): Promise<StrategyBrief> {
  const result = await request("/api/strategy/generate", user, signal, {
    idea: idea.trim(),
    clarifications,
  });
  const brief = parseBrief(result.data);
  if (!brief) throw new ApiError(invalidAIResponse, result.requestId);
  return brief;
}

function parseCandidate(value: unknown): NamingCandidate | null {
  if (!object(value)) return null;
  if (
    !boundedText(value.id, 80) ||
    !boundedText(value.name, 40) ||
    !boundedText(value.rationale, 300) ||
    !boundedText(value.territory, 80)
  )
    return null;
  const candidate: NamingCandidate = {
    id: value.id,
    name: value.name,
    rationale: value.rationale,
    territory: value.territory,
  };
  if (value.linguisticNote !== undefined && value.linguisticNote !== null) {
    if (!boundedText(value.linguisticNote, 200)) return null;
    candidate.linguisticNote = value.linguisticNote;
  }
  return candidate;
}

export async function generateNamingCandidates(
  strategy: StrategyBrief,
  user: User | null,
  signal: AbortSignal,
): Promise<NamingCandidate[]> {
  const result = await request("/api/naming/candidates", user, signal, {
    strategy,
  });
  const data = result.data;
  const candidates =
    object(data) && Array.isArray(data.candidates) ? data.candidates : null;
  if (
    !candidates ||
    candidates.length !== 5 ||
    !candidates.every((c) => parseCandidate(c) !== null) ||
    new Set(candidates.map((c) => (c as NamingCandidate).id)).size !== 5 ||
    new Set(candidates.map((c) => (c as NamingCandidate).name.toLowerCase())).size !==
      5
  ) {
    throw new ApiError(invalidAIResponse, result.requestId);
  }
  return candidates as unknown as NamingCandidate[];
}

function scoreValue(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5
  );
}

function parseEvaluation(
  value: unknown,
  candidateIds: Set<string>,
): NamingEvaluation | null {
  if (!object(value)) return null;
  const scores =
    object(value.scores) &&
    scoreValue(value.scores.distinctiveness) &&
    scoreValue(value.scores.strategicFit) &&
    scoreValue(value.scores.memorability) &&
    scoreValue(value.scores.extensibility)
      ? {
          distinctiveness: value.scores.distinctiveness,
          strategicFit: value.scores.strategicFit,
          memorability: value.scores.memorability,
          extensibility: value.scores.extensibility,
        }
      : null;
  const points = (v: unknown) =>
    Array.isArray(v) &&
    v.length >= 1 &&
    v.length <= 3 &&
    v.every((item) => boundedText(item, 120));
  if (
    !boundedText(value.candidateId, 80) ||
    !candidateIds.has(value.candidateId) ||
    !scores ||
    !points(value.strengths) ||
    !points(value.risks) ||
    !boundedText(value.verdict, 300)
  )
    return null;
  return {
    candidateId: value.candidateId,
    scores,
    strengths: value.strengths as string[],
    risks: value.risks as string[],
    verdict: value.verdict,
  };
}

export async function evaluateNamingCandidates(
  strategy: StrategyBrief,
  candidates: NamingCandidate[],
  user: User | null,
  signal: AbortSignal,
): Promise<NamingEvaluation[]> {
  const result = await request("/api/naming/evaluate", user, signal, {
    strategy,
    candidates,
  });
  const data = result.data;
  const evaluations =
    object(data) && Array.isArray(data.evaluations) ? data.evaluations : null;
  const candidateIds = new Set(candidates.map((c) => c.id));
  if (
    !evaluations ||
    evaluations.length !== 5 ||
    !evaluations.every((e) => parseEvaluation(e, candidateIds) !== null) ||
    new Set(
      evaluations.map((e) => (e as NamingEvaluation).candidateId),
    ).size !== 5
  ) {
    throw new ApiError(invalidAIResponse, result.requestId);
  }
  return evaluations as unknown as NamingEvaluation[];
}

export async function generateDirections(
  strategy: StrategyBrief,
  shortlistedCandidates: NamingCandidate[],
  evaluations: NamingEvaluation[],
  user: User | null,
  signal: AbortSignal,
): Promise<BrandDirection[]> {
  const result = await request("/api/directions/generate", user, signal, {
    strategy, shortlistedCandidates, evaluations,
  });
  if (!object(result.data) || !validDirections(result.data.directions, shortlistedCandidates.map(c => c.id))) {
    throw new ApiError(invalidAIResponse, result.requestId);
  }
  return [...result.data.directions].sort((a, b) => a.id.localeCompare(b.id));
}

export async function generateBrandKit(
  strategy: StrategyBrief, selectedCandidate: NamingCandidate, selectedDirection: BrandDirection,
  user: User | null, signal: AbortSignal,
): Promise<BrandKit> {
  const result = await request("/api/brand-kit/generate", user, signal, { strategy, selectedCandidate, selectedDirection });
  const kit = result.data;
  if (!validBrandKit(kit, selectedCandidate.name) ||
    !COLOR_ROLES.every(role => kit.colors[role] === selectedDirection.colors[role])) {
    throw new ApiError(invalidAIResponse, result.requestId);
  }
  return kit;
}

export async function reviewSpellcheck(
  brandKit: BrandKit,
  content: string,
  user: User | null,
  signal: AbortSignal,
): Promise<SpellcheckReview> {
  const result = await request("/api/spellcheck/review", user, signal, { brandKit, content });
  if (!validSpellcheckReview(result.data, brandKit, content)) {
    throw new ApiError(invalidAIResponse, result.requestId);
  }
  return result.data as unknown as SpellcheckReview;
}
