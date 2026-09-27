import { auth } from "./firebase";

/** A lightweight session identity, independent of Firebase specifics. */
export interface AppSession {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string | null;
}

// Development-only local session bypass: active only in dev builds when
// VITE_DEV_AUTH_BYPASS=1 and Firebase is unconfigured. Never active in production.
export const authDeferred =
  Boolean(import.meta.env.DEV) &&
  import.meta.env.VITE_DEV_AUTH_BYPASS === "1" &&
  auth === null;

export const DEV_UID = "dev-local";

export const devSession: AppSession = {
  uid: DEV_UID,
  displayName: "Local session",
  email: "Local development preview",
};

export function sessionOfUser(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL?: string | null;
  isAnonymous?: boolean;
}): AppSession {
  return {
    uid: user.uid,
    displayName: user.isAnonymous
      ? "Guest"
      : user.displayName || user.email || "Signed in",
    email: user.email ?? "",
    photoURL: user.photoURL ?? null,
  };
}

const GUEST_FLAG_KEY = "aakaro:is_guest";
const GUEST_UID_KEY = "aakaro:guest_uid";

export function getStoredGuestUid(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(GUEST_UID_KEY);
  } catch {
    return null;
  }
}

export function isGuestSessionActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(GUEST_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function createGuestSession(): AppSession {
  let uid = getStoredGuestUid();
  if (!uid) {
    const randomSuffix =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);
    uid = `guest-${randomSuffix}`;
    try {
      localStorage.setItem(GUEST_UID_KEY, uid);
    } catch {
      // ignore storage failure
    }
  }
  try {
    localStorage.setItem(GUEST_FLAG_KEY, "1");
  } catch {
    // ignore storage failure
  }
  return {
    uid,
    displayName: "Guest",
    email: "",
    photoURL: null,
  };
}

export function getGuestSession(): AppSession | null {
  if (!isGuestSessionActive()) return null;
  const uid = getStoredGuestUid() || "guest-session";
  return {
    uid,
    displayName: "Guest",
    email: "",
    photoURL: null,
  };
}

export function clearGuestSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_FLAG_KEY);
  } catch {
    // ignore
  }
}

