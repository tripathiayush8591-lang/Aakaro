// @vitest-environment jsdom
import { beforeEach, expect, test, vi } from "vitest";
import type { User } from "firebase/auth";
const state = vi.hoisted(() => ({
  auth: { currentUser: null as User | null },
}));
vi.mock("./firebase", () => ({ auth: state.auth }));
import { checkHealth, testConnection } from "./api";
const fetchMock = vi.fn();
const result = {
  requestId: "test",
  data: {
    summary: "A tool",
    possibleAudience: "Students",
    clarifyingQuestion: "Where?",
  },
};
beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:8000");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
test("attaches SDK ID token and matching request IDs", async () => {
  const user = {
    getIdToken: vi.fn().mockResolvedValue("test-token"),
  } as unknown as User;
  state.auth.currentUser = user;
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(result), { status: 200 }),
  );
  await testConnection("  idea  ", user, new AbortController().signal);
  const [, init] = fetchMock.mock.calls[0];
  expect(init.headers.Authorization).toBe("Bearer test-token");
  expect(JSON.parse(init.body)).toEqual({
    idea: "idea",
    requestId: init.headers["X-Request-ID"],
  });
});
test("session change during token retrieval prevents the request", async () => {
  const user = {
    getIdToken: vi.fn().mockImplementation(async () => {
      state.auth.currentUser = null;
      return "old-token";
    }),
  } as unknown as User;
  state.auth.currentUser = user;
  await expect(
    testConnection("idea", user, new AbortController().signal),
  ).rejects.toThrow();
  expect(fetchMock).not.toHaveBeenCalled();
});
test("health is public and validates actual success", async () => {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ requestId: "h", data: { status: "ok" } })),
  );
  await checkHealth(new AbortController().signal);
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ requestId: "h", data: { status: "wrong" } })),
  );
  await expect(checkHealth(new AbortController().signal)).rejects.toThrow();
});
test("normalized provider errors preserve actionable category", async () => {
  const user = {
    getIdToken: vi.fn().mockResolvedValue("token"),
  } as unknown as User;
  state.auth.currentUser = user;
  fetchMock.mockResolvedValue(
    new Response(
      JSON.stringify({
        requestId: "r",
        error: {
          code: "PROVIDER_TIMEOUT",
          message: "Try again.",
          retryable: true,
        },
      }),
      { status: 504 },
    ),
  );
  await expect(
    testConnection("idea", user, new AbortController().signal),
  ).rejects.toMatchObject({
    requestId: "r",
    detail: { code: "PROVIDER_TIMEOUT", retryable: true },
  });
});
