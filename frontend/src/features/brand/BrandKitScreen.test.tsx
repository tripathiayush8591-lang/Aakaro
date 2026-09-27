// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Workspace } from "./Workspace";
import { BrandKitScreen } from "./BrandKitScreen";
import { projectReducer } from "../../lib/project";
import { parseProject, projectKey } from "../../lib/storage";
import { editingProject, kitProject, kit, timestamp } from "./brandKit.fixture";
import type { AakaroProject } from "../../types/project";

vi.mock("../../lib/firebase", () => ({ auth: null }));
const session = { uid: "dev-local", displayName: "Local session", email: "" };
const fetchMock = vi.fn();
const stored = () => JSON.parse(localStorage.getItem(projectKey(session.uid))!) as AakaroProject;
function mount(p = kitProject()) {
  localStorage.setItem(projectKey(session.uid), JSON.stringify(p));
  return render(<Workspace session={session} user={null} authDeferred />);
}
beforeEach(() => {
  localStorage.clear(); vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000");
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("blocks without a locked direction and offers recovery", async () => {
  const p = kitProject(); p.directions.status = "ready";
  const dispatch = vi.fn();
  render(<BrandKitScreen project={p} dispatch={dispatch} user={null} />);
  expect(screen.getByText("Lock one direction first.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: /Back to Directions/ }));
  expect(dispatch).toHaveBeenCalledWith({ type: "backToDirections" });
  expect(fetchMock).not.toHaveBeenCalled();
});

test("generates from confirmed inputs and renders identity, colors, rules and preview", async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ requestId: "r", data: kit })));
  const p = kitProject(); mount(p);
  await userEvent.click(screen.getByRole("button", { name: /Build my brand kit/ }));
  expect(await screen.findByLabelText("Tagline")).toHaveProperty("value", kit.identity.tagline);
  expect(screen.getByLabelText("primary HEX")).toHaveProperty("value", kit.colors.primary);
  expect(screen.getByLabelText("Rule 6")).toBeTruthy();
  expect(within(screen.getByRole("region", { name: "Live brand preview" })).getByText(kit.identity.tagline)).toBeTruthy();
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.strategy).toEqual(p.strategy.confirmed);
  expect(body.selectedCandidate).toEqual(p.naming.candidates[0]);
  expect(body.selectedDirection).toEqual(p.directions.items[0]);
  expect(Object.keys(body).sort()).toEqual(["requestId", "selectedCandidate", "selectedDirection", "strategy"]);
});

test("edits persist, preview updates, invalid HEX stays unsaved and blocks confirmation", async () => {
  const view = mount(editingProject());
  fireEvent.change(screen.getByLabelText("Tagline"), { target: { value: "Make room for your next idea." } });
  fireEvent.change(screen.getByLabelText("Rule 1"), { target: { value: "Use second person in invitations." } });
  expect(within(screen.getByRole("region", { name: "Live brand preview" })).getByText("Make room for your next idea.")).toBeTruthy();
  expect(stored().brandKit.draft?.rules[0].rule).toBe("Use second person in invitations.");
  view.unmount(); render(<Workspace session={session} user={null} authDeferred />);
  expect(screen.getByLabelText("Tagline")).toHaveProperty("value", "Make room for your next idea.");
  expect(screen.getByLabelText("Rule 1")).toHaveProperty("value", "Use second person in invitations.");
  fireEvent.change(screen.getByLabelText("primary HEX"), { target: { value: "#GGGGGG" } });
  expect(stored().brandKit.draft?.colors.primary).toBe(kit.colors.primary);
  expect(screen.getByRole("button", { name: /Confirm brand kit/ })).toHaveProperty("disabled", true);
  fireEvent.change(screen.getByLabelText("primary HEX"), { target: { value: "#123456" } });
  expect(screen.getByRole("button", { name: /Confirm brand kit/ })).toHaveProperty("disabled", false);
  fireEvent.change(screen.getByLabelText("Rationale 1"), { target: { value: "" } });
  expect(screen.getByRole("button", { name: /Confirm brand kit/ })).toHaveProperty("disabled", true);
  expect(parseProject(stored())?.brandKit.draft?.rules[0].rationale).toBe("");
});

test("clay modal cancels, confirms and restores Spellcheck-ready; unlock preserves edits", async () => {
  const view = mount(editingProject());
  await userEvent.click(screen.getByRole("button", { name: /Confirm brand kit/ }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
  expect(stored().brandKit.confirmed).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /Confirm brand kit/ }));
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Confirm brand kit/ }));
  expect(screen.getByText("Spellcheck-ready.")).toBeTruthy();
  expect(stored().brandKit.confirmed).toEqual(kit);
  expect(stored().brandKit.confirmedAt).toEqual(expect.any(String));
  expect(stored().currentStage).toBe("spellcheck");
  view.unmount(); render(<Workspace session={session} user={null} authDeferred />);
  expect(screen.getByText("Spellcheck-ready.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Edit brand kit" }));
  expect(stored().brandKit.confirmed).toBeNull();
  expect(screen.getByLabelText("Tagline")).toHaveProperty("value", kit.identity.tagline);
});

test("failure and malformed responses preserve direction and allow retry", async () => {
  const p = kitProject(); mount(p);
  fetchMock.mockRejectedValueOnce(new Error("network"));
  await userEvent.click(screen.getByRole("button", { name: /Build my brand kit/ }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "We couldn't finish your brand kit. Your selected direction is safe.");
  for (const bad of [{}, { ...kit, rules: [] }, { ...kit, identity: { ...kit.identity, name: "Changed" } }]) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ requestId: "r", data: bad })));
    await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
    await screen.findByRole("alert");
    expect(stored().directions).toEqual(p.directions);
  }
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ requestId: "r", data: kit })));
  await userEvent.click(screen.getByRole("button", { name: /Try again/ }));
  expect(await screen.findByLabelText("Tagline")).toBeTruthy();
});

test("upstream changes invalidate kit and stale responses cannot commit", () => {
  const p = editingProject();
  for (const type of ["unlockDirection", "unlockNaming", "unlockStrategy"] as const) {
    const changed = projectReducer(p, { type });
    expect(changed.brandKit.draft).toBeNull();
  }
  const source = kitProject();
  const pending = projectReducer(source, { type: "brandKitStart", expectedRevision: source.revision });
  const changed = projectReducer(pending, { type: "unlockDirection" });
  expect(projectReducer(changed, { type: "brandKitSuccess", draft: kit, generatedAt: timestamp, expectedRevision: pending.revision })).toBe(changed);
  expect(projectReducer(p, { type: "editBrandKit", draft: { ...kit, identity: { ...kit.identity, name: "Renamed" } } })).toBe(p);
  expect(projectReducer(p, { type: "editBrandKit", draft: { ...kit, colors: { ...kit.colors, primary: "red" } } })).toBe(p);
});

test("migration and interrupted generation recover; corrupt confirmed rules are rejected", () => {
  const p = kitProject();
  expect(parseProject({ ...p, brandKit: undefined })?.brandKit.status).toBe("idle");
  expect(parseProject({ ...p, brandKit: { ...p.brandKit, status: "generating" } })?.brandKit.status).toBe("idle");
  const confirmed = projectReducer(editingProject(), { type: "confirmBrandKit", confirmedAt: timestamp });
  expect(parseProject(confirmed)?.brandKit.confirmed).toEqual(kit);
  confirmed.brandKit.confirmed!.rules[0].id = "bad";
  expect(parseProject(confirmed)).toBeNull();
});
