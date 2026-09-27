import { createProject } from "../../lib/project";
import type { AakaroProject, BrandDirection, BrandKit } from "../../types/project";
export const timestamp = "2026-09-27T10:00:00.000Z";
const strategy = {
  oneLiner: "Find a teammate.", audience: { primary: "Students", description: "First-time builders." },
  problem: "No team.", promise: "Meet builders.", differentiation: "Intent first.",
  personality: ["Warm", "Focused", "Honest"], positioning: "A calm place to connect.", namingTerritories: ["Warm", "Direct"],
};
export function namingProject(): AakaroProject {
  const p = createProject();
  return { ...p, currentStage: "directions", strategy: { draft: strategy, confirmed: strategy, confirmedAt: timestamp },
    naming: {
      candidates: ["Milo", "Field", "Arc", "Kin", "Beam"].map((name, i) => ({ id: `n${i + 1}`, name, rationale: "A shared place.", territory: "Warm" })),
      evaluations: [1, 2, 3, 4, 5].map(i => ({ candidateId: `n${i}`, scores: { distinctiveness: 3, strategicFit: 4, memorability: 3, extensibility: 4 }, strengths: ["Easy to say."], risks: ["Broad meaning."], verdict: "A fitting name." })),
      selectedIds: ["n1", "n2"], graveyardIds: ["n3", "n4", "n5"], generationStatus: "confirmed", generatedAt: timestamp, confirmedAt: timestamp,
    } };
}
export const directions: BrandDirection[] = [1, 2].map(i => ({
  id: i === 1 ? "direction1" : "direction2", candidateId: `n${i}`, conceptName: i === 1 ? "Open invitation" : "Building blocks",
  conceptStatement: "A shared place to meet and build.", personality: ["Warm", "Focused", "Honest"],
  colors: { primary: i === 1 ? "#813F2D" : "#203F3A", secondary: "#DBAC87", accent: "#F1CB68", background: "#FFF4E7", rationale: "Dark headings on warm paper." },
  typography: { headingStyle: i === 1 ? "Manrope bold tight lowercase" : "DM Sans medium spaced uppercase", bodyStyle: "Regular open spacing", rationale: "Clear and welcoming." },
  logoApproach: { approach: i === 1 ? "Open circle" : "Offset square", rationale: "A shared place." },
  imagery: { style: "Overlapping shapes", rationale: "Suggests collaboration." },
  voice: { traits: ["Warm", "Clear", "Honest"], sampleLine: "Find your next teammate." },
}));

export function kitProject(): AakaroProject {
  return { ...namingProject(), currentStage: "brand-kit", directions: {
    items: directions, selectedDirectionId: "direction1", status: "confirmed", generatedAt: timestamp, confirmedAt: timestamp,
  } };
}
const d = directions[0];
export const kit: BrandKit = {
  identity: { name: "Milo", tagline: "Find your next teammate.", descriptor: "A meeting place for builders." },
  colors: { primary: d.colors.primary, secondary: d.colors.secondary, accent: d.colors.accent, background: d.colors.background },
  typography: { headingStyle: d.typography.headingStyle, bodyStyle: d.typography.bodyStyle, usageGuidance: "Keep headlines short." },
  wordmark: { treatment: "Open circular wordmark", casing: "lowercase", tracking: "tight", weight: "bold" },
  imagery: { style: d.imagery.style, guidance: d.imagery.rationale },
  voice: { traits: d.voice.traits, description: "Speak directly to student builders.",
    preferredLanguage: ["Active verbs", "Short sentences", "Concrete outcomes"], avoidedLanguage: ["Jargon", "Inflated claims", "Exclusionary labels"] },
  rules: ["voice", "language", "messaging", "visual", "voice", "language"].map((category, index) => ({
    id: `rule${index + 1}`, category: category as BrandKit["rules"][number]["category"], rule: "Address readers as you.", rationale: "Keeps the invitation personal.",
  })),
};
export function editingProject(): AakaroProject {
  return { ...kitProject(), brandKit: { draft: structuredClone(kit), confirmed: null, status: "ready", generatedAt: timestamp } };
}
