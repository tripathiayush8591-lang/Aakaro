// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Workspace } from "./Workspace";
import { createProject, projectReducer } from "../../lib/project";
import { parseProject, projectKey } from "../../lib/storage";
import { emptyDirectionsState, type AakaroProject, type BrandDirection } from "../../types/project";

vi.mock("../../lib/firebase", () => ({ auth: null }));
const session = { uid: "dev-local", displayName: "Local session", email: "" };
const fetchMock = vi.fn();
const timestamp = "2026-09-27T10:00:00.000Z";
const strategy = {
  oneLiner: "Find a teammate.", audience: { primary: "Students", description: "First-time builders." },
  problem: "No team.", promise: "Meet builders.", differentiation: "Intent first.",
  personality: ["Warm", "Focused", "Honest"], positioning: "A calm place to connect.", namingTerritories: ["Warm", "Direct"],
};
function project(): AakaroProject {
  const p = createProject();
  return { ...p, currentStage: "directions", strategy: { draft: strategy, confirmed: strategy, confirmedAt: timestamp },
    naming: {
      candidates: ["Milo", "Field", "Arc", "Kin", "Beam"].map((name, i) => ({ id: `n${i + 1}`, name, rationale: "A shared place.", territory: "Warm" })),
      evaluations: [1, 2, 3, 4, 5].map(i => ({ candidateId: `n${i}`, scores: { distinctiveness: 3, strategicFit: 4, memorability: 3, extensibility: 4 }, strengths: ["Easy to say."], risks: ["Broad meaning."], verdict: "A fitting name." })),
      selectedIds: ["n1", "n2"], graveyardIds: ["n3", "n4", "n5"], generationStatus: "confirmed", generatedAt: timestamp, confirmedAt: timestamp,
    } };
}
const directions: BrandDirection[] = [1, 2].map(i => ({
  id: i === 1 ? "direction1" : "direction2", candidateId: `n${i}`, conceptName: i === 1 ? "Open invitation" : "Building blocks",
  conceptStatement: "A shared place to meet and build.", personality: ["Warm", "Focused", "Honest"],
  colors: { primary: i === 1 ? "#813F2D" : "#203F3A", secondary: "#DBAC87", accent: "#F1CB68", background: "#FFF4E7", rationale: "Dark headings on warm paper." },
  typography: { headingStyle: i === 1 ? "Manrope bold tight lowercase" : "DM Sans medium spaced uppercase", bodyStyle: "Regular open spacing", rationale: "Clear and welcoming." },
  logoApproach: { approach: i === 1 ? "Open circle" : "Offset square", rationale: "A shared place." },
  imagery: { style: "Overlapping shapes", rationale: "Suggests collaboration." },
  voice: { traits: ["Warm", "Clear", "Honest"], sampleLine: "Find your next teammate." },
}));
function ready(): AakaroProject {
  return { ...project(), directions: { items: directions, selectedDirectionId: null, status: "ready", generatedAt: timestamp } };
}
function mount(p = project()) {
  localStorage.setItem(projectKey(session.uid), JSON.stringify(p));
  return render(<Workspace session={session} user={null} authDeferred />);
}
const stored = () => JSON.parse(localStorage.getItem(projectKey(session.uid))!) as AakaroProject;

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  // JSDOM lacks native dialog methods; browser verification covers actual focus containment.
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("blocks directions without confirmed naming and provides a way back", async () => {
  const p = project(); p.naming.generationStatus = "ready"; p.naming.graveyardIds = [];
  mount(p);
  expect(screen.getByText("Confirm your naming decision first.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Build my directions/ })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /Back to naming/ }));
  expect(screen.getByText("Five names, evaluated.")).toBeTruthy();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("generates exactly two boards using only the confirmed strategy and shortlist", async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ requestId: "r", data: { directions } })));
  mount();
  await userEvent.click(screen.getByRole("button", { name: /Build my directions/ }));
  expect(await screen.findAllByRole("article", { name: /Direction for/ })).toHaveLength(2);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.strategy).toEqual(strategy);
  expect(body.shortlistedCandidates.map((c: { id: string }) => c.id)).toEqual(["n1", "n2"]);
  expect(body.evaluations.map((e: { candidateId: string }) => e.candidateId)).toEqual(["n1", "n2"]);
  expect(Object.keys(body).sort()).toEqual(["evaluations", "requestId", "shortlistedCandidates", "strategy"]);
});

test("select, switch, cancel, escape, lock and reload preserve exactly one direction", async () => {
  const view = mount(ready());
  const lock = screen.getByRole("button", { name: /Lock this direction/ }) as HTMLButtonElement;
  expect(lock.disabled).toBe(true);
  expect(screen.getByText("Choose the direction you want to develop.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Select direction for Milo" }));
  expect(lock.disabled).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Select direction for Field" }));
  expect(screen.getByRole("button", { name: "Select direction for Milo" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "Select direction for Field" }).getAttribute("aria-pressed")).toBe("true");
  await userEvent.click(lock);
  const dialog = screen.getByRole("dialog");
  const cancel = within(dialog).getByRole("button", { name: "Cancel" });
  cancel.focus();
  await userEvent.tab({ shift: true });
  expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: /Lock direction/ }));
  await userEvent.tab();
  expect(document.activeElement).toBe(cancel);
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(stored().directions.status).toBe("ready");
  await userEvent.click(lock);
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await userEvent.click(lock);
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Lock direction/ }));
  expect(screen.getByText("Brand Kit-ready.")).toBeTruthy();
  expect(stored().directions).toMatchObject({ status: "confirmed", selectedDirectionId: "direction2", confirmedAt: expect.any(String) });
  expect(stored().currentStage).toBe("brand-kit");
  view.unmount();
  render(<Workspace session={session} user={null} authDeferred />);
  expect(screen.getByText("Brand Kit-ready.")).toBeTruthy();
  expect(screen.getByText("Field · Building blocks")).toBeTruthy();
});

test("generation failure and invalid transport payload preserve naming for retry", async () => {
  const p = project();
  fetchMock.mockRejectedValueOnce(new Error("network"));
  mount(p);
  await userEvent.click(screen.getByRole("button", { name: /Build my directions/ }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "We couldn't finish these brand directions. Your naming decision is safe.");
  for (const defect of ["color", "mapping"]) {
    const malformed = structuredClone(directions);
    if (defect === "color") malformed[0].colors.primary = "url(unsafe)";
    else malformed[1].candidateId = "n5";
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ requestId: "r", data: { directions: malformed } })));
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await screen.findByRole("alert");
    expect(stored().naming).toEqual(p.naming);
  }
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ requestId: "r", data: { directions } })));
  await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
  expect(await screen.findAllByRole("article", { name: /Direction for/ })).toHaveLength(2);
});

test("revisiting naming invalidates directions and keeps candidate evaluation history", async () => {
  const p = ready(); mount(p);
  await userEvent.click(screen.getByRole("button", { name: "Revisit naming" }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Revisit naming/ }));
  expect(stored().directions).toEqual(emptyDirectionsState());
  expect(stored().naming.candidates).toEqual(p.naming.candidates);
  expect(stored().naming.evaluations).toEqual(p.naming.evaluations);
  await userEvent.click(screen.getByRole("button", { name: "Shortlisted Milo" }));
  expect(stored().directions.items).toHaveLength(0);
});

test("strategy invalidation and revision guards reject stale directions", () => {
  const p = project();
  const pending = projectReducer(p, { type: "directionsStart", expectedRevision: p.revision });
  const unlocked = projectReducer(pending, { type: "unlockStrategy" });
  const stale = projectReducer(unlocked, { type: "directionsSuccess", items: directions, generatedAt: timestamp, expectedRevision: pending.revision });
  expect(stale).toBe(unlocked);
  expect(stale.directions).toEqual(emptyDirectionsState());
  expect(stale.naming.candidates).toHaveLength(0);
  expect(projectReducer(ready(), { type: "confirmDirection", confirmedAt: timestamp }).directions.status).toBe("ready");
});

test("restores Phase 3 saves, recovers interrupted generation, rejects corrupt directions", () => {
  const p = project();
  const legacy = { ...p, directions: undefined };
  expect(parseProject(legacy)?.directions).toEqual(emptyDirectionsState());
  expect(parseProject({ ...p, directions: { ...p.directions, status: "generating" } })?.directions.status).toBe("idle");
  const invalid = ready(); invalid.directions.items = [directions[0], directions[0]];
  expect(parseProject(invalid)).toBeNull();
});
