import type {
  AakaroProject,
  BrandKit,
  SpellcheckIssue,
  SpellcheckReview,
  SpellcheckReviewRecord,
} from "../types/project";

export const CONTENT_MAX = 8000;

const SEVERITIES = ["low", "medium", "high"];
const CATEGORIES = ["voice", "language", "messaging", "visual", "consistency"];
const SOURCES = ["deterministic", "ai"];

const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.trim().length > 0 && v.length <= max;

function issueIsStructural(value: unknown, ruleIds: Set<string>): boolean {
  if (!object(value)) return false;
  const issue = value as Record<string, unknown>;
  if (
    typeof issue.id !== "string" ||
    issue.id.length > 8 ||
    !SOURCES.includes(String(issue.source)) ||
    !ruleIds.has(String(issue.ruleId)) ||
    !SEVERITIES.includes(String(issue.severity)) ||
    !CATEGORIES.includes(String(issue.category)) ||
    typeof issue.originalText !== "string" ||
    issue.originalText.length < 1 ||
    issue.originalText.length > 300 ||
    !text(issue.explanation, 400) ||
    !text(issue.suggestion, 400)
  )
    return false;
  if (issue.replacement !== undefined && issue.replacement !== null) {
    if (!text(issue.replacement, 400)) return false;
  }
  if (issue.start !== undefined || issue.end !== undefined) {
    if (
      typeof issue.start !== "number" ||
      typeof issue.end !== "number" ||
      !Number.isInteger(issue.start) ||
      !Number.isInteger(issue.end) ||
      issue.start < 0 ||
      issue.end <= issue.start
    )
      return false;
  }
  return true;
}

/**
 * Structural validation shared by fresh and stored reviews: bounded text,
 * rule ids that exist in the confirmed kit, and well-formed issue shapes.
 * Quotes and offsets are grounded separately against the exact content.
 */
function validSpellcheckReviewShape(
  value: unknown,
  kit: BrandKit,
): value is SpellcheckReview {
  if (!object(value)) return false;
  const ruleIds = new Set(kit.rules.map((rule) => rule.id));
  const review = value as Record<string, unknown>;
  return (
    text(review.summary, 400) &&
    Array.isArray(review.issues) &&
    review.issues.length <= 12 &&
    review.issues.every((issue) => issueIsStructural(issue, ruleIds)) &&
    Array.isArray(review.passedRuleIds) &&
    review.passedRuleIds.length <= kit.rules.length &&
    new Set(review.passedRuleIds).size === review.passedRuleIds.length &&
    review.passedRuleIds.every((id) => typeof id === "string" && ruleIds.has(id)) &&
    typeof review.aiReviewed === "boolean" &&
    text(review.reviewedAt, 40)
  );
}

/**
 * Browser-restored reviews: may be stale — their quotes refer to an earlier
 * content revision — so quotes and offsets are not checked against the
 * current working content here.
 */
export function validStoredSpellcheckReview(
  value: unknown,
  kit: BrandKit,
): value is SpellcheckReviewRecord {
  if (!object(value) || typeof value.stale !== "boolean") return false;
  return validSpellcheckReviewShape(value, kit);
}

/**
 * Strict validation of a fresh AI-transport review against the confirmed kit
 * and the exact submitted content: every issue must reference a real rule id
 * and a quote that exists verbatim, and any offsets must match the quote.
 */
export function validSpellcheckReview(
  value: unknown,
  kit: BrandKit,
  content: string,
): value is SpellcheckReview {
  if (!validSpellcheckReviewShape(value, kit)) return false;
  const review = value;
  const seen = new Set<string>();
  return review.issues.every((issue) => {
    const key = `${issue.ruleId}\u0000${issue.originalText.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    if (typeof issue.start === "number" && typeof issue.end === "number") {
      if (
        issue.end > content.length ||
        content.slice(issue.start, issue.end) !== issue.originalText
      )
        return false;
    }
    return content.includes(issue.originalText);
  });
}

/**
 * Apply one fix: replace the quoted original text in the working content.
 * Prefers the recorded offsets when they still match exactly; otherwise falls
 * back to the quote only when it occurs exactly once — with several
 * candidates, applying would be a guess. Returns null when the target cannot
 * be located unambiguously.
 */
export function applyReplacement(
  content: string,
  issue: SpellcheckIssue,
): string | null {
  if (!issue.replacement) return null;
  if (
    typeof issue.start === "number" &&
    typeof issue.end === "number" &&
    issue.start >= 0 &&
    issue.end <= content.length &&
    content.slice(issue.start, issue.end) === issue.originalText
  ) {
    return content.slice(0, issue.start) + issue.replacement + content.slice(issue.end);
  }
  const first = content.indexOf(issue.originalText);
  if (first < 0 || content.indexOf(issue.originalText, first + 1) >= 0) return null;
  return (
    content.slice(0, first) +
    issue.replacement +
    content.slice(first + issue.originalText.length)
  );
}

/** Plain-text Markdown export of the checked content and its rule-linked review. */
export function spellcheckMarkdown(project: AakaroProject): string {
  const kit = project.brandKit.confirmed;
  const spellcheck = project.spellcheck;
  const review = spellcheck.review;
  const lines: string[] = [
    `# Brand Spellcheck — ${kit ? kit.identity.name : "Untitled brand"}`,
    "",
    `Status: ${spellcheck.status === "complete" ? "Confirmed" : review ? (review.stale ? "Needs re-check" : "Checked") : "Not checked"}`,
    "",
    "## Content",
    "",
    spellcheck.workingContent,
    "",
  ];
  if (spellcheck.originalContent !== spellcheck.workingContent) {
    lines.push(
      "> The original pasted text is preserved in the app; this export shows the edited working copy.",
      "",
    );
  }
  if (review) {
    lines.push("## Review", "", review.summary, "");
    if (review.issues.length > 0) {
      lines.push("### Issues", "");
      for (const issue of review.issues) {
        lines.push(
          `- [${issue.severity}] ${issue.category} — ${issue.ruleId}: ${issue.explanation}`,
          `  - Quote: "${issue.originalText}"`,
          `  - Suggestion: ${issue.suggestion}`,
        );
        if (issue.replacement) {
          lines.push(`  - Replacement: ${issue.replacement}`);
        }
      }
      lines.push("");
    }
    if (kit) {
      const passed = kit.rules.filter((rule) =>
        review.passedRuleIds.includes(rule.id),
      );
      if (passed.length > 0) {
        lines.push("### Rules that passed", "");
        for (const rule of passed) {
          lines.push(`- ${rule.id}: ${rule.rule}`);
        }
        lines.push("");
      }
    }
    if (!review.aiReviewed) {
      lines.push(
        "> AI review was unavailable, so only deterministic rule checks ran.",
        "",
      );
    }
  }
  return lines.join("\n");
}

/** Triggers a browser download of the Markdown export. */
export function downloadSpellcheckMarkdown(project: AakaroProject): void {
  const blob = new Blob([spellcheckMarkdown(project)], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `aakaro-spellcheck-${project.id.slice(0, 8)}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
