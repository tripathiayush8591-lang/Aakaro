// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { User } from "firebase/auth";
const mocks = vi.hoisted(() => ({
  listener: null as null | ((user: User | null) => void),
  login: vi.fn(),
  logout: vi.fn(),
  testConnection: vi.fn(),
  checkHealth: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (
    _auth: unknown,
    listener: (user: User | null) => void,
  ) => {
    mocks.listener = listener;
    return () => {};
  },
}));
vi.mock("./lib/firebase", () => ({
  auth: {},
  login: mocks.login,
  logout: mocks.logout,
  authMessage: () => "Sign-in was cancelled. Try again.",
}));
vi.mock("./lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/api")>()),
  checkHealth: mocks.checkHealth,
  testConnection: mocks.testConnection,
}));
import App from "./App";
import { ApiError } from "./lib/api";
const user = {
  uid: "one",
  displayName: "Test Person",
  email: "person@example.test",
} as User;
const response = {
  requestId: "test",
  data: {
    summary: "Private idea summary",
    possibleAudience: "Students",
    clarifyingQuestion: "Which campus?",
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkHealth.mockResolvedValue(undefined);
  mocks.logout.mockImplementation(async () => {
    mocks.listener?.(null);
  });
});
afterEach(cleanup);
async function signedIn() {
  render(<App />);
  await act(async () => {
    mocks.listener?.(user);
  });
}
test("auth initializes separately; sign-in page has no diagnostics", async () => {
  render(<App />);
  expect(
    (
      screen.getByRole("button", {
        name: "Checking your session…",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await act(async () => {
    mocks.listener?.(null);
  });
  expect(
    screen.getByRole("button", { name: "Continue with Google" }),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Your idea")).toBeNull();
});
test("provider failure preserves input and supports retry", async () => {
  mocks.testConnection
    .mockRejectedValueOnce(
      new ApiError({
        code: "PROVIDER_QUOTA",
        message: "Wait before retrying.",
        retryable: false,
      }),
    )
    .mockResolvedValueOnce(response);
  await signedIn();
  await userEvent.type(screen.getByLabelText("Your idea"), "Campus teammates");
  await userEvent.click(
    screen.getByRole("button", { name: "Test AI connection" }),
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(
    (screen.getByLabelText("Your idea") as HTMLTextAreaElement).value,
  ).toBe("Campus teammates");
  await userEvent.click(
    screen.getByRole("button", { name: "Retry AI connection" }),
  );
  expect(await screen.findByText("Private idea summary")).toBeTruthy();
});
test("sign-out clears results and pending old-session responses cannot reappear", async () => {
  let finish: (value: typeof response) => void = () => {};
  mocks.testConnection.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  await signedIn();
  await userEvent.type(screen.getByLabelText("Your idea"), "Private idea");
  await userEvent.click(
    screen.getByRole("button", { name: "Test AI connection" }),
  );
  expect(
    (
      screen.getByRole("button", {
        name: "Testing AI connection…",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await act(async () => {
    finish(response);
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeTruthy(),
  );
  expect(screen.queryByText("Private idea summary")).toBeNull();
  await act(async () => {
    mocks.listener?.({ ...user, uid: "two" });
  });
  expect(
    (screen.getByLabelText("Your idea") as HTMLTextAreaElement).value,
  ).toBe("");
  expect(screen.queryByText("Private idea summary")).toBeNull();
});
test("completed output disappears on sign-out", async () => {
  mocks.testConnection.mockResolvedValue(response);
  await signedIn();
  await userEvent.type(screen.getByLabelText("Your idea"), "An idea");
  await userEvent.click(
    screen.getByRole("button", { name: "Test AI connection" }),
  );
  await screen.findByText("Private idea summary");
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(screen.queryByText("Private idea summary")).toBeNull();
});
