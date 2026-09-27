import { describe, expect, test } from "vitest";
import {
  applyReplacement,
  spellcheckMarkdown,
  validSpellcheckReview,
  validStoredSpellcheckReview,
} from "./spellcheck";
import { createProject, projectReducer } from "./project";
import { parseProject } from "./storage";
import { emptySpellcheckState } from "../types/project";
import type { SpellcheckIssue, SpellcheckReview } from "../types/project";
import { editingProject, kit, timestamp } from "../features/brand/brandKit.fixture";

const CONTENT = "Our revolutionary app helps students find teammates.";
const START = CONTENT.indexOf("revolutionary");
const END = START + "revolutionary".length;

const issue: SpellcheckIssue = {
  id: "i1",
  source: "ai",
  ruleId: "rule2",
  severity: "high",
  category: "language",
  originalText: "revolutionary",
  start: START,
  end: END,
  explanation: "Inflated claim conflicts with your language rule.",
  suggestion: "Use concrete language.",
  replacement: "practical",
};

const review: SpellcheckReview = {
  summary: "One phrase conflicts with your language rule.",
  issues: [issue],
  passedRuleIds: ["rule1", "rule3", "rule4", "rule5", "rule6"],
  aiReviewed: true,
  reviewedAt: timestamp,
};

function checkedProject(): ReturnType<typeof createProject> {
  let p = projectReducer(editingProject(), { type: "confirmBrandKit", confirmedAt: timestamp });
  p = projectReducer(p, { type: "spellcheckEditContent", text: CONTENT });
  const atStart = p.revision;
  p = projectReducer(p, { type: "spellcheckReviewStart", expectedRevision: atStart });
  return projectReducer(p, {
    type: "spellcheckReviewSuccess",
    review: { ...review, stale: false },
    expectedRevision: atStart + 1,
  });
}

describe("review validation", () => {
  test("a fresh API review without a stale flag is accepted", () => {
    expect(validSpellcheckReview(review, kit, CONTENT)).toBe(true);
  });

  test("ungrounded quotes and unknown rules are rejected", () => {
    const ungrounded = {
      ...review,
      issues: [{ ...issue, originalText: "not in the content", start: undefined, end: undefined }],
    };
    expect(validSpellcheckReview(ungrounded, kit, CONTENT)).toBe(false);
    expect(
      validSpellcheckReview({ ...review, issues: [{ ...issue, ruleId: "rule99" }] }, kit, CONTENT),
    ).toBe(false);
    expect(
      validSpellcheckReview({ ...review, issues: [{ ...issue, end: CONTENT.length + 5 }] }, kit, CONTENT),
    ).toBe(false);
  });

  test("stored reviews require the stale flag; fresh ones do not", () => {
    expect(validStoredSpellcheckReview({ ...review, stale: true }, kit)).toBe(true);
    expect(validStoredSpellcheckReview(review, kit)).toBe(false);
  });
});

describe("apply fix never guesses", () => {
  test("replaces at recorded offsets while they still match", () => {
    expect(applyReplacement(CONTENT, issue)).toBe(
      "Our practical app helps students find teammates.",
    );
  });

  test("falls back only to an unambiguous single occurrence", () => {
    const shifted = { ...issue, start: 0, end: 3 };
    expect(applyReplacement(CONTENT, shifted)).toBe(
      "Our practical app helps students find teammates.",
    );
    const doubled = "revolutionary idea, revolutionary results.";
    expect(applyReplacement(doubled, { ...issue, start: 0, end: 3 })).toBeNull();
    expect(applyReplacement(CONTENT, { ...issue, replacement: undefined })).toBeNull();
  });
});

describe("spellcheck reducer", () => {
  test("confirming the kit lands on spellcheck with empty state", () => {
    const p = projectReducer(editingProject(), { type: "confirmBrandKit", confirmedAt: timestamp });
    expect(p.currentStage).toBe("spellcheck");
    expect(p.brandKit.confirmed).toEqual(kit);
    expect(p.spellcheck).toEqual(emptySpellcheckState());
  });

  test("the first paste records the original; edits move only the working copy", () => {
    let p = projectReducer(editingProject(), { type: "confirmBrandKit", confirmedAt: timestamp });
    p = projectReducer(p, { type: "spellcheckEditContent", text: CONTENT });
    expect(p.spellcheck.originalContent).toBe(CONTENT);
    expect(p.spellcheck.workingContent).toBe(CONTENT);
    p = projectReducer(p, { type: "spellcheckEditContent", text: "Edited content." });
    expect(p.spellcheck.originalContent).toBe(CONTENT);
    expect(p.spellcheck.workingContent).toBe("Edited content.");
    expect(p.spellcheck.review).toBeNull();
  });

  test("a check commits; a stale response cannot", () => {
    const p = checkedProject();
    expect(p.spellcheck.review?.stale).toBe(false);
    expect(p.spellcheck.review?.issues[0].ruleId).toBe("rule2");
    // Replay the success against the now-advanced revision: discarded.
    expect(
      projectReducer(p, {
        type: "spellcheckReviewSuccess",
        review: { ...review, stale: false },
        expectedRevision: p.revision,
      }),
    ).toBe(p);
  });

  test("apply fix changes the working copy only and marks the review stale", () => {
    const p = checkedProject();
    const fixed = projectReducer(p, {
      type: "spellcheckApplyFix",
      issueId: "i1",
      nextContent: "Our practical app helps students find teammates.",
    });
    expect(fixed.spellcheck.workingContent).toBe(
      "Our practical app helps students find teammates.",
    );
    expect(fixed.spellcheck.originalContent).toBe(CONTENT);
    expect(fixed.spellcheck.review?.stale).toBe(true);
    // Unknown issue id is a no-op.
    expect(projectReducer(p, { type: "spellcheckApplyFix", issueId: "nope", nextContent: "x" })).toBe(p);
  });

  test("completion requires a fresh review and unlock clears the spellcheck", () => {
    const p = checkedProject();
    const done = projectReducer(p, { type: "spellcheckComplete", confirmedAt: timestamp });
    expect(done.spellcheck.status).toBe("complete");
    expect(done.spellcheck.confirmedAt).toBe(timestamp);
    // A stale review cannot complete.
    const stale = projectReducer(p, { type: "spellcheckEditContent", text: "Changed." });
    expect(projectReducer(stale, { type: "spellcheckComplete", confirmedAt: timestamp })).toBe(stale);
    const unlocked = projectReducer(done, { type: "unlockBrandKit" });
    expect(unlocked.spellcheck).toEqual(emptySpellcheckState());
    expect(unlocked.currentStage).toBe("brand-kit");
  });

  test("refresh persistence keeps the checked content and review", () => {
    const p = checkedProject();
    const restored = parseProject(JSON.parse(JSON.stringify(p)));
    expect(restored?.spellcheck.workingContent).toBe(CONTENT);
    expect(restored?.spellcheck.originalContent).toBe(CONTENT);
    expect(restored?.spellcheck.review?.stale).toBe(false);
    expect(restored?.spellcheck.review?.issues).toHaveLength(1);
  });
});

describe("markdown export", () => {
  test("carries the content, the rule-linked issue and passed rules", () => {
    const md = spellcheckMarkdown(checkedProject());
    expect(md).toContain("# Brand Spellcheck — Milo");
    expect(md).toContain(CONTENT);
    expect(md).toContain("revolutionary");
    expect(md).toContain("rule2");
    expect(md).toContain("practical");
    expect(md).toContain("### Rules that passed");
  });
});
