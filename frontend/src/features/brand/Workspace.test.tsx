// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  clarifyIdea: vi.fn(),
  generateStrategy: vi.fn(),
  generateNamingCandidates: vi.fn(),
  evaluateNamingCandidates: vi.fn(),
}));
vi.mock("../../lib/api", () => ({
  ApiError: class extends Error {
    constructor(
      public detail: { code: string; message: string; retryable: boolean },
    ) {
      super(detail.message);
    }
  },
  clarifyIdea: mocks.clarifyIdea,
  generateStrategy: mocks.generateStrategy,
  generateNamingCandidates: mocks.generateNamingCandidates,
  evaluateNamingCandidates: mocks.evaluateNamingCandidates,
}));
import { Workspace } from "./Workspace";
import type {
  AakaroProject,
  ClarificationQuestion,
  NamingCandidate,
  NamingEvaluation,
  StrategyBrief,
} from "../../types/project";
import { projectKey } from "../../lib/storage";

const UID = "dev-local";
const questions: ClarificationQuestion[] = [
  { id: "q1", question: "Who feels this problem most?", reason: "Audience first." },
  { id: "q2", question: "What makes it different?", reason: "Differentiation." },
  { id: "q3", question: "What should it feel like?", reason: "Personality." },
];
const brief: StrategyBrief = {
  oneLiner: "Teammates found on intent, not noise.",
  audience: {
    primary: "First-time hackathon participants",
    description: "Students forming their first teams.",
  },
  problem: "Good teammates are hard to find quickly.",
  promise: "A focused match in minutes.",
  differentiation: "Matching on skills and intent.",
  personality: ["Welcoming", "Focused", "Honest"],
  positioning: "The calm alternative to noisy group chats.",
  namingTerritories: ["Coined & Warm", "Plain Spoken"],
};
const session = { uid: UID, displayName: "Local session", email: "" };

const candidates: NamingCandidate[] = [
  {
    id: "n1",
    name: "Matchly",
    rationale: "Coined from the promise of matching on intent.",
    territory: "Coined & Warm",
    linguisticNote: "Pronounced MATCH-lee.",
  },
  { id: "n2", name: "Plainly", rationale: "Direct and honest by construction.", territory: "Plain Spoken" },
  { id: "n3", name: "Warmhold", rationale: "A warm place to land.", territory: "Coined & Warm" },
  { id: "n4", name: "Teamora", rationale: "Flowing and friendly.", territory: "Coined & Warm" },
  { id: "n5", name: "Candid", rationale: "Honest, at face value.", territory: "Plain Spoken" },
];
const evaluations: NamingEvaluation[] = candidates.map((c, i) => ({
  candidateId: c.id,
  scores: {
    distinctiveness: 5 - (i % 2),
    strategicFit: 4,
    memorability: 4 - (i % 3),
    extensibility: 3 + (i % 2),
  },
  strengths: ["Short and concrete."],
  risks: ["Could blend in with similar tools."],
  verdict: `Trade-off notes for ${c.name}.`,
}));

function namingState(overrides: Partial<AakaroProject["naming"]> = {}) {
  return {
    candidates: [],
    evaluations: [],
    selectedIds: [],
    graveyardIds: [],
    generationStatus: "idle" as const,
    ...overrides,
  };
}

function savedProject(overrides: Partial<AakaroProject>): AakaroProject {
  const base: AakaroProject = {
    schemaVersion: 1,
    id: "project-1",
    createdAt: "2026-09-27T10:00:00.000Z",
    updatedAt: "2026-09-27T10:05:00.000Z",
    revision: 7,
    currentStage: "idea",
    idea: { rawIdea: "A teammate finder for hackathons." },
    clarification: { questions, answers: [], completed: false },
    strategy: { draft: null, confirmed: null },
    naming: namingState(),
    directions: { items: [], selectedDirectionId: null, status: "idle" },
  };
  return { ...base, ...overrides } as AakaroProject;
}

function confirmedProject(): AakaroProject {
  return savedProject({
    currentStage: "naming",
    clarification: {
      questions,
      answers: questions.map((q) => ({ questionId: q.id, answer: "A" })),
      completed: true,
    },
    strategy: {
      draft: brief,
      confirmed: brief,
      confirmedAt: "2026-09-27T10:06:00.000Z",
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.confirm = vi.fn(() => true);
});
afterEach(cleanup);

test("empty idea keeps the continue action disabled; entered idea is stored", async () => {
  render(<Workspace session={session} user={null} authDeferred />);
  const continueButton = screen.getByRole("button", {
    name: /Shape my idea/,
  }) as HTMLButtonElement;
  expect(continueButton.disabled).toBe(true);
  await userEvent.type(screen.getByLabelText("Your idea"), "Campus teammate finder");
  expect(continueButton.disabled).toBe(false);
  const stored = JSON.parse(
    localStorage.getItem(projectKey(UID)) ?? "null",
  ) as AakaroProject | null;
  expect(stored?.idea.rawIdea).toBe("Campus teammate finder");
});

test("questions appear one at a time; navigation preserves answers; completion enables strategy", async () => {
  mocks.clarifyIdea.mockResolvedValue(questions);
  mocks.generateStrategy.mockResolvedValue(brief);
  render(<Workspace session={session} user={null} authDeferred />);
  await userEvent.type(screen.getByLabelText("Your idea"), "A teammate finder.");
  await userEvent.click(screen.getByRole("button", { name: /Shape my idea/ }));
  expect(await screen.findByText(questions[0].question)).toBeTruthy();
  expect(screen.queryByText(questions[1].question)).toBeNull();
  await userEvent.type(screen.getByLabelText("Your answer"), "Beginners");
  await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
  await screen.findByText(questions[1].question);
  await userEvent.click(screen.getByRole("button", { name: /Back/ }));
  expect(
    (screen.getByLabelText("Your answer") as HTMLTextAreaElement).value,
  ).toBe("Beginners");
  await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
  await screen.findByText(questions[1].question);
  await userEvent.type(screen.getByLabelText("Your answer"), "Skill matching");
  await userEvent.click(screen.getByRole("button", { name: /Continue/ }));
  await screen.findByText(questions[2].question);
  await userEvent.type(screen.getByLabelText("Your answer"), "Welcoming");
  await userEvent.click(
    screen.getByRole("button", { name: /Build my strategy/ }),
  );
  await waitFor(() =>
    expect(mocks.generateStrategy).toHaveBeenCalledWith(
      "A teammate finder.",
      [
        { question: questions[0].question, answer: "Beginners" },
        { question: questions[1].question, answer: "Skill matching" },
        { question: questions[2].question, answer: "Welcoming" },
      ],
      null,
      expect.anything(),
    ),
  );
  expect(await screen.findByText(brief.oneLiner)).toBeTruthy();
});

test("failed strategy generation keeps answers and retries without restarting", async () => {
  mocks.generateStrategy
    .mockRejectedValueOnce(
      new (class extends Error {
        detail = { code: "X", message: "AI took too long. Please try again.", retryable: true };
      })(),
    )
    .mockResolvedValueOnce(brief);
  localStorage.setItem(
    projectKey(UID),
    JSON.stringify(
      savedProject({
        currentStage: "strategy",
        clarification: {
          questions,
          answers: questions.map((q) => ({ questionId: q.id, answer: "A" })),
          completed: true,
        },
      }),
    ),
  );
  render(<Workspace session={session} user={null} authDeferred />);
  expect(await screen.findByRole("alert")).toBeTruthy();
  const stored = JSON.parse(
    localStorage.getItem(projectKey(UID)) ?? "null",
  ) as AakaroProject;
  expect(stored.clarification.completed).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText(/The strategy your identity/)).toBeTruthy();
});

test("refresh restores the saved strategy review; locking updates stage and storage", async () => {
  localStorage.setItem(
    projectKey(UID),
    JSON.stringify(
      savedProject({
        currentStage: "strategy",
        clarification: {
          questions,
          answers: questions.map((q) => ({ questionId: q.id, answer: "A" })),
          completed: true,
        },
        strategy: { draft: brief, confirmed: null },
      }),
    ),
  );
  render(<Workspace session={session} user={null} authDeferred />);
  expect(await screen.findByText(brief.oneLiner)).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: /Lock strategy/ }),
  );
  expect(await screen.findByText("Strategy locked.")).toBeTruthy();
  const stored = JSON.parse(
    localStorage.getItem(projectKey(UID)) ?? "null",
  ) as AakaroProject;
  expect(stored.currentStage).toBe("naming");
  expect(stored.strategy.confirmed?.oneLiner).toBe(brief.oneLiner);
  expect(stored.strategy.confirmedAt).toBeTruthy();
});

test("editing a strategy field persists the edit to canonical state", async () => {
  localStorage.setItem(
    projectKey(UID),
    JSON.stringify(
      savedProject({
        currentStage: "strategy",
        clarification: {
          questions,
          answers: questions.map((q) => ({ questionId: q.id, answer: "A" })),
          completed: true,
        },
        strategy: { draft: brief, confirmed: null },
      }),
    ),
  );
  render(<Workspace session={session} user={null} authDeferred />);
  await screen.findByText(brief.oneLiner);
  await userEvent.click(screen.getByRole("button", { name: "Edit One-liner" }));
  const oneLiner = screen.getByLabelText("One-liner") as HTMLInputElement;
  await userEvent.clear(oneLiner);
  await userEvent.type(oneLiner, "Edited one-liner.");
  fireEvent.blur(oneLiner);
  const stored = JSON.parse(
    localStorage.getItem(projectKey(UID)) ?? "null",
  ) as AakaroProject;
  expect(stored.strategy.draft?.oneLiner).toBe("Edited one-liner.");
});

test("naming generates from the confirmed strategy, evaluates, and reaches the shortlist", async () => {
  mocks.generateNamingCandidates.mockResolvedValue(candidates);
  mocks.evaluateNamingCandidates.mockResolvedValue(evaluations);
  localStorage.setItem(projectKey(UID), JSON.stringify(confirmedProject()));
  render(<Workspace session={session} user={null} authDeferred />);
  expect(await screen.findByText("Strategy locked.")).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: /Generate 5 names/ }),
  );
  expect(mocks.generateNamingCandidates).toHaveBeenCalledWith(
    brief,
    null,
    expect.anything(),
  );
  await waitFor(() =>
    expect(mocks.evaluateNamingCandidates).toHaveBeenCalledWith(
      brief,
      candidates,
      null,
      expect.anything(),
    ),
  );
  expect(await screen.findByText("Five names, evaluated.")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /^Shortlist / })).toHaveLength(5);
  const matchly = screen.getByRole("article", { name: "Candidate Matchly" });
  expect(within(matchly).getByLabelText("Distinctive: 5 out of 5")).toBeTruthy();
  const stored = JSON.parse(
    localStorage.getItem(projectKey(UID)) ?? "null",
  ) as AakaroProject;
  expect(stored.naming.generationStatus).toBe("ready");
  expect(stored.naming.candidates).toHaveLength(5);
});

test("a refresh during evaluation resumes it without regenerating candidates", async () => {
  mocks.evaluateNamingCandidates.mockReturnValue(
    new Promise(() => {}),
  );
  localStorage.setItem(
    projectKey(UID),
    JSON.stringify(
      savedProject({
        ...confirmedProject(),
        naming: namingState({
          candidates,
          generationStatus: "generated",
          generatedAt: "2026-09-27T10:07:00.000Z",
        }),
      }),
    ),
  );
  render(<Workspace session={session} user={null} authDeferred />);
  expect(await screen.findByText("Scoring your five names.")).toBeTruthy();
  expect(mocks.evaluateNamingCandidates).toHaveBeenCalledTimes(1);
  expect(mocks.generateNamingCandidates).not.toHaveBeenCalled();
});

test("failed generation keeps the locked strategy; failed evaluation keeps the candidates", async () => {
  mocks.generateNamingCandidates
    .mockRejectedValueOnce(
      new (class extends Error {
        detail = { code: "X", message: "AI took too long. Please try again.", retryable: true };
      })(),
    )
    .mockResolvedValueOnce(candidates);
  mocks.evaluateNamingCandidates
    .mockRejectedValueOnce(
      new (class extends Error {
        detail = { code: "X", message: "AI quota reached. Wait before retrying.", retryable: false };
      })(),
    )
    .mockResolvedValueOnce(evaluations);
  localStorage.setItem(projectKey(UID), JSON.stringify(confirmedProject()));
  render(<Workspace session={session} user={null} authDeferred />);
  await userEvent.click(
    screen.getByRole("button", { name: /Generate 5 names/ }),
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("Strategy locked.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: /Generate 5 names/ }));
  expect(await screen.findByText("Your five names are safe.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: /Evaluate again/ }));
  expect(await screen.findByText("Five names, evaluated.")).toBeTruthy();
  const stored = JSON.parse(
    localStorage.getItem(projectKey(UID)) ?? "null",
  ) as AakaroProject;
  expect(stored.naming.candidates).toHaveLength(5);
  expect(mocks.generateNamingCandidates).toHaveBeenCalledTimes(2);
  expect(mocks.evaluateNamingCandidates).toHaveBeenCalledTimes(2);
});

test("shortlist is capped at two; the other three enter The Graveyard; confirm advances the stage", async () => {
  localStorage.setItem(
    projectKey(UID),
    JSON.stringify(
      savedProject({
        ...confirmedProject(),
        naming: namingState({
          candidates,
          evaluations,
          generationStatus: "ready",
          generatedAt: "2026-09-27T10:07:00.000Z",
        }),
      }),
    ),
  );
  render(<Workspace session={session} user={null} authDeferred />);
  await screen.findByText("Five names, evaluated.");
  await userEvent.click(screen.getByRole("button", { name: "Shortlist Matchly" }));
  await userEvent.click(screen.getByRole("button", { name: "Shortlist Plainly" }));
  const third = screen.getByRole("button", {
    name: "Shortlist Warmhold",
  }) as HTMLButtonElement;
  expect(third.disabled).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: /Confirm naming decision/ }));
  expect(await screen.findByText("Two ways your identity could come alive.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: /The Graveyard/ }));
  const graveyard = screen.getByLabelText(
    "The Graveyard — alternatives we evaluated",
  );
  expect(graveyard.textContent).toContain("Warmhold");
  expect(graveyard.textContent).toContain("Teamora");
  expect(graveyard.textContent).toContain("Candid");
  expect(graveyard.textContent).not.toContain("Matchly");
  const stored = JSON.parse(
    localStorage.getItem(projectKey(UID)) ?? "null",
  ) as AakaroProject;
  expect(stored.currentStage).toBe("directions");
  expect(stored.naming.generationStatus).toBe("confirmed");
  expect(stored.naming.selectedIds).toEqual(["n1", "n2"]);
  expect(stored.naming.graveyardIds).toEqual(["n3", "n4", "n5"]);
  expect(stored.naming.confirmedAt).toBeTruthy();
});

test("refresh restores the ready shortlist with the saved selection", async () => {
  localStorage.setItem(
    projectKey(UID),
    JSON.stringify(
      savedProject({
        ...confirmedProject(),
        naming: namingState({
          candidates,
          evaluations,
          selectedIds: ["n5"],
          generationStatus: "ready",
          generatedAt: "2026-09-27T10:07:00.000Z",
        }),
      }),
    ),
  );
  render(<Workspace session={session} user={null} authDeferred />);
  expect(await screen.findByText("Five names, evaluated.")).toBeTruthy();
  const selected = screen.getByRole("button", {
    name: "Shortlisted Candid",
  }) as HTMLButtonElement;
  expect(selected.getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByText("1 of 2 shortlisted · pick 1 more")).toBeTruthy();
  const other = screen.getByRole("button", {
    name: "Shortlist Matchly",
  }) as HTMLButtonElement;
  expect(other.getAttribute("aria-pressed")).toBe("false");
});

test("unlocking the strategy from naming clears the naming candidates", async () => {
  localStorage.setItem(
    projectKey(UID),
    JSON.stringify(
      savedProject({
        ...confirmedProject(),
        naming: namingState({
          candidates,
          evaluations,
          generationStatus: "ready",
          generatedAt: "2026-09-27T10:07:00.000Z",
        }),
      }),
    ),
  );
  render(<Workspace session={session} user={null} authDeferred />);
  await screen.findByText("Five names, evaluated.");
  await userEvent.click(
    screen.getByRole("button", { name: "Unlock to edit strategy" }),
  );
  await screen.findByText(/The strategy your identity/);
  const stored = JSON.parse(
    localStorage.getItem(projectKey(UID)) ?? "null",
  ) as AakaroProject;
  expect(stored.currentStage).toBe("strategy");
  expect(stored.strategy.confirmed).toBeNull();
  expect(stored.naming.candidates).toHaveLength(0);
  expect(stored.naming.generationStatus).toBe("idle");
});
