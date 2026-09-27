import type { User } from "firebase/auth";
import { auth } from "./firebase";
import type { ApiFailure, ConnectionResult, Success } from "../types/api";

export class ApiError extends Error {
  constructor(
    public detail: ApiFailure,
    public requestId?: string,
  ) {
    super(detail.message);
  }
}
function baseUrl(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    return value.replace(/\/$/, "");
  } catch {
    throw new ApiError({
      code: "CONFIGURATION_ERROR",
      message:
        "The API address is not configured. Set VITE_API_BASE_URL and restart the frontend.",
      retryable: false,
    });
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function request(
  path: string,
  user: User | null,
  signal: AbortSignal,
  body?: object,
): Promise<Success<unknown>> {
  const requestId = crypto.randomUUID();
  const headers: Record<string, string> = { "X-Request-ID": requestId };
  try {
    if (user) {
      const token = await user.getIdToken();
      if (auth?.currentUser !== user || signal.aborted)
        throw new DOMException("Session changed", "AbortError");
      headers.Authorization = `Bearer ${token}`;
    }
    if (body) headers["Content-Type"] = "application/json";
    const response = await fetch(`${baseUrl()}${path}`, {
      method: body ? "POST" : "GET",
      headers,
      signal: AbortSignal.any([signal, AbortSignal.timeout(55000)]),
      body: body ? JSON.stringify({ ...body, requestId }) : undefined,
    });
    const payload: unknown = await response.json();
    if (user && (auth?.currentUser !== user || signal.aborted)) {
      throw new DOMException("Session changed", "AbortError");
    }
    if (
      object(payload) &&
      object(payload.error) &&
      typeof payload.error.message === "string" &&
      typeof payload.error.code === "string" &&
      typeof payload.error.retryable === "boolean"
    ) {
      throw new ApiError(
        {
          code: payload.error.code,
          message: payload.error.message,
          retryable: payload.error.retryable,
        },
        typeof payload.requestId === "string" ? payload.requestId : requestId,
      );
    }
    if (
      !response.ok ||
      !object(payload) ||
      typeof payload.requestId !== "string" ||
      !("data" in payload)
    )
      throw new Error("Invalid response");
    return { requestId: payload.requestId, data: payload.data };
  } catch (error) {
    if (signal.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      {
        code: "NETWORK_ERROR",
        message:
          "Could not complete the request. Check your connection and that the backend is running, then retry.",
        retryable: true,
      },
      requestId,
    );
  }
}
export async function checkHealth(signal: AbortSignal) {
  const result = await request("/health", null, signal);
  if (!object(result.data) || result.data.status !== "ok")
    throw new Error("Unexpected health response");
}
export async function testConnection(
  idea: string,
  user: User,
  signal: AbortSignal,
): Promise<Success<ConnectionResult>> {
  const result = await request("/api/connection-test", user, signal, {
    idea: idea.trim(),
  });
  const data = result.data;
  if (
    !object(data) ||
    !["summary", "possibleAudience", "clarifyingQuestion"].every(
      (key) =>
        typeof data[key] === "string" &&
        (data[key] as string).trim().length > 0 &&
        (data[key] as string).length <= 1200,
    )
  ) {
    throw new ApiError(
      {
        code: "INVALID_RESPONSE",
        message: "The server returned an unexpected response. Try again.",
        retryable: true,
      },
      result.requestId,
    );
  }
  return {
    requestId: result.requestId,
    data: data as unknown as ConnectionResult,
  };
}
