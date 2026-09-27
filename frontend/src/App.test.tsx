// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { User } from "firebase/auth";
const mocks = vi.hoisted(() => ({
  listener: null as null | ((user: User | null) => void),
  login: vi.fn(),
  loginAsGuest: vi.fn(),
  logout: vi.fn(),
  clarifyIdea: vi.fn(),
  generateStrategy: vi.fn(),
  checkHealth: vi.fn(),
  testConnection: vi.fn(),
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
  loginAsGuest: mocks.loginAsGuest,
  logout: mocks.logout,
  authMessage: () => "Sign-in was cancelled. Try again.",
}));
vi.mock("./lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lib/api")>()),
  checkHealth: mocks.checkHealth,
  testConnection: mocks.testConnection,
  clarifyIdea: mocks.clarifyIdea,
  generateStrategy: mocks.generateStrategy,
}));
import App from "./App";
import { ApiError } from "./lib/api";
import type { ClarificationQuestion } from "./types/project";
const user = {
  uid: "one",
  displayName: "Test Person",
  email: "person@example.test",
} as User;
const questions: ClarificationQuestion[] = [
  { id: "q1", question: "Who is it for?", reason: "Audience shapes the voice." },
  { id: "q2", question: "What changes?", reason: "Differentiation shapes the name." },
  { id: "q3", question: "What feel?", reason: "Personality shapes the look." },
];
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.confirm = vi.fn(() => true);
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
test("auth initializes separately; sign-in page has no product flow", async () => {
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
test("clarify failure preserves the idea and supports retry", async () => {
  mocks.clarifyIdea
    .mockRejectedValueOnce(
      new ApiError({
        code: "PROVIDER_QUOTA",
        message: "Wait before retrying.",
        retryable: false,
      }),
    )
    .mockResolvedValueOnce(questions);
  await signedIn();
  await userEvent.type(screen.getByLabelText("Your idea"), "Campus teammates");
  await userEvent.click(
    screen.getByRole("button", { name: /Shape my idea/ }),
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
  await userEvent.click(
    screen.getByRole("button", { name: /Back to your idea/ }),
  );
  expect(
    (screen.getByLabelText("Your idea") as HTMLTextAreaElement).value,
  ).toBe("Campus teammates");
  await userEvent.click(
    screen.getByRole("button", { name: /Shape my idea/ }),
  );
  expect(await screen.findByText("Who is it for?")).toBeTruthy();
});
test("sign-out mid-generation discards the late response; accounts stay separate", async () => {
  let finish: (value: ClarificationQuestion[]) => void = () => {};
  mocks.clarifyIdea.mockImplementation(
    () =>
      new Promise<ClarificationQuestion[]>((resolve) => {
        finish = resolve;
      }),
  );
  await signedIn();
  await userEvent.type(screen.getByLabelText("Your idea"), "Private idea");
  await userEvent.click(
    screen.getByRole("button", { name: /Shape my idea/ }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await act(async () => {
    finish(questions);
  });
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Continue with Google" }),
    ).toBeTruthy(),
  );
  expect(screen.queryByText("Who is it for?")).toBeNull();
  await act(async () => {
    mocks.listener?.({ ...user, uid: "two" });
  });
  expect(
    (screen.getByLabelText("Your idea") as HTMLTextAreaElement).value,
  ).toBe("");
});
test("completed progress is kept per account, not shared across sessions", async () => {
  mocks.clarifyIdea.mockResolvedValue(questions);
  await signedIn();
  await userEvent.type(screen.getByLabelText("Your idea"), "An idea");
  await userEvent.click(
    screen.getByRole("button", { name: /Shape my idea/ }),
  );
  await screen.findByText("Who is it for?");
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(screen.queryByText("Who is it for?")).toBeNull();
  await act(async () => {
    mocks.listener?.({ ...user, uid: "two" });
  });
  expect(
    (screen.getByLabelText("Your idea") as HTMLTextAreaElement).value,
  ).toBe("");
});

test("Google sign-in triggers login and popup cancellation shows error allowing retry", async () => {
  render(<App />);
  await act(async () => {
    mocks.listener?.(null);
  });
  const button = screen.getByRole("button", { name: "Continue with Google" });

  // Popup cancelled error
  mocks.login.mockRejectedValueOnce(new Error("Sign-in was cancelled. Try again."));
  await userEvent.click(button);
  expect(mocks.login).toHaveBeenCalledTimes(1);
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("Sign-in was cancelled. Try again.")).toBeTruthy();

  // Retry success
  mocks.login.mockImplementationOnce(async () => {
    mocks.listener?.(user);
  });
  await userEvent.click(button);
  expect(await screen.findByLabelText("Your idea")).toBeTruthy();
});

test("Continue as guest directly redirects to workspace as Guest and signs out normally", async () => {
  render(<App />);
  await act(async () => {
    mocks.listener?.(null);
  });
  const guestButton = screen.getByRole("button", { name: "Continue as guest" });

  // Clicking "Continue as guest" directly enters the workspace with a Guest session
  await userEvent.click(guestButton);
  expect(await screen.findByText("Guest")).toBeTruthy();
  expect(screen.queryByText("person@example.test")).toBeNull();
  expect(screen.getByLabelText("Your idea")).toBeTruthy();

  // Sign out returns to the auth page like any other session.
  await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(
    await screen.findByRole("button", { name: "Continue with Google" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Continue as guest" }),
  ).toBeTruthy();
});


test("signed-in workspace displays displayName, email, and avatar when available", async () => {
  render(<App />);
  const userWithAvatar = {
    ...user,
    displayName: "Jane Designer",
    email: "jane@brand.test",
    photoURL: "https://example.test/avatar.png",
  } as User;

  await act(async () => {
    mocks.listener?.(userWithAvatar);
  });

  expect(await screen.findByText("Jane Designer")).toBeTruthy();
  expect(screen.getByText("jane@brand.test")).toBeTruthy();
  const avatar = screen.getByAltText("Jane Designer") as HTMLImageElement;
  expect(avatar).toBeTruthy();
  expect(avatar.src).toBe("https://example.test/avatar.png");
});

