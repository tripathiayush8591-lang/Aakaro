// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useReducer } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reviewSpellcheck: vi.fn() }));
vi.mock("../../lib/api", () => ({
  ApiError: class extends Error {
    constructor(
      public detail: { code: string; message: string; retryable: boolean },
    ) {
      super(detail.message);
    }
  },
  reviewSpellcheck: mocks.reviewSpellcheck,
}));

import { SpellcheckScreen } from "./SpellcheckScreen";
import { projectReducer } from "../../lib/project";
import type { ProjectAction } from "../../lib/project";
import { editingProject, kit, timestamp } from "./brandKit.fixture";
import type { AakaroProject, SpellcheckReview } from "../../types/project";

const CONTENT = "Our revolutionary app helps students find teammates.";
const START = CONTENT.indexOf("revolutionary");

const review: SpellcheckReview = {
  summary: "One phrase conflicts with your language rule.",
  issues: [
    {
      id: "i1",
      source: "ai",
      ruleId: "rule2",
      severity: "high",
      category: "language",
      originalText: "revolutionary",
      start: START,
      end: START + 13,
      explanation: "Inflated claim conflicts with the rule.",
      suggestion: "Use concrete language.",
      replacement: "practical",
    },
  ],
  passedRuleIds: ["rule1", "rule3", "rule4", "rule5", "rule6"],
  aiReviewed: true,
  reviewedAt: timestamp,
};

function pastedProject(): AakaroProject {
  let p = projectReducer(editingProject(), { type: "confirmBrandKit", confirmedAt: timestamp });
  return projectReducer(p, { type: "spellcheckEditContent", text: CONTENT });
}

/**
 * Reducer-backed mount: dispatches really move the state forward, and every
 * action is mirrored to a spy so tests can assert on the dispatch stream.
 */
function liveScreen(onAction?: (action: ProjectAction) => void) {
  function Wrapper() {
    const [project, dispatch] = useReducer(projectReducer, undefined, pastedProject);
    const track = (action: ProjectAction) => {
      onAction?.(action);
      dispatch(action);
    };
    return <SpellcheckScreen project={project} dispatch={track} user={null} />;
  }
  return <Wrapper />;
}

beforeEach(() => {
  localStorage.clear();
  mocks.reviewSpellcheck.mockReset();
});
afterEach(cleanup);

test("blocks without a confirmed brand kit", () => {
  const p = pastedProject();
  render(
    <SpellcheckScreen
      project={{ ...p, brandKit: { ...p.brandKit, confirmed: null } }}
      dispatch={vi.fn()}
      user={null}
    />,
  );
  expect(screen.getByText("Confirm your brand kit first.")).toBeTruthy();
});

test("check sends the confirmed kit and latest content; issues link to real rules", async () => {
  mocks.reviewSpellcheck.mockResolvedValue(review);
  const actions: ProjectAction[] = [];
  render(liveScreen((action) => actions.push(action)));
  await userEvent.click(screen.getByRole("button", { name: "Check content" }));
  await waitFor(() =>
    expect(mocks.reviewSpellcheck).toHaveBeenCalledWith(kit, CONTENT, null, expect.anything()),
  );
  expect(actions).toContainEqual({
    type: "spellcheckReviewStart",
    expectedRevision: expect.any(Number),
  });
  expect(await screen.findByText(/Inflated claim conflicts/)).toBeTruthy();
  expect(screen.getByText(/Confirmed rule: Address readers as you\./)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Apply fix" })).toBeTruthy();
});

test("apply fix dispatches the replaced working content only", async () => {
  mocks.reviewSpellcheck.mockResolvedValue(review);
  const actions: ProjectAction[] = [];
  render(liveScreen((action) => actions.push(action)));
  await userEvent.click(screen.getByRole("button", { name: "Check content" }));
  await userEvent.click(await screen.findByRole("button", { name: "Apply fix" }));
  expect(actions).toContainEqual({
    type: "spellcheckApplyFix",
    issueId: "i1",
    nextContent: "Our practical app helps students find teammates.",
  });
  // The original paste survives the fix; the review needs a re-check.
  expect(await screen.findByText(/changed after this check/i)).toBeTruthy();
});

test("a zero-issue check shows the compliant state and enables finishing", async () => {
  mocks.reviewSpellcheck.mockResolvedValue({
    ...review,
    issues: [],
    passedRuleIds: ["rule1", "rule2", "rule3", "rule4", "rule5", "rule6"],
  });
  const actions: ProjectAction[] = [];
  render(liveScreen((action) => actions.push(action)));
  await userEvent.click(screen.getByRole("button", { name: "Check content" }));
  expect(await screen.findByText("No rule conflicts found.")).toBeTruthy();
  expect(screen.getByText(/6 of 6 confirmed rules passed/)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Finish spellcheck" }));
  expect(actions).toContainEqual({
    type: "spellcheckComplete",
    confirmedAt: expect.any(String),
  });
  expect(await screen.findByText("Content confirmed.")).toBeTruthy();
});

test("editing the content marks the review stale; re-check sends the latest content", async () => {
  mocks.reviewSpellcheck.mockResolvedValue(review);
  render(liveScreen());
  await userEvent.click(screen.getByRole("button", { name: "Check content" }));
  await screen.findByText(/Inflated claim conflicts/);
  const area = screen.getByLabelText("Content to check") as HTMLTextAreaElement;
  await userEvent.clear(area);
  await userEvent.type(area, `${CONTENT}!`);
  expect(await screen.findByText(/changed after this check/i)).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Re-check content" }));
  await waitFor(() =>
    expect(mocks.reviewSpellcheck).toHaveBeenLastCalledWith(
      kit,
      `${CONTENT}!`,
      null,
      expect.anything(),
    ),
  );
});

test("markdown download and print actions work after a check", async () => {
  mocks.reviewSpellcheck.mockResolvedValue(review);
  const createObjectURL = vi.fn(() => "blob:x");
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  render(liveScreen());
  await userEvent.click(screen.getByRole("button", { name: "Check content" }));
  await screen.findByText(/Inflated claim conflicts/);
  await userEvent.click(screen.getByRole("button", { name: "Download Markdown" }));
  expect(createObjectURL).toHaveBeenCalled();
  expect(click).toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Print / Save as PDF" }));
  expect(print).toHaveBeenCalled();
});
