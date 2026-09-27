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
}): AppSession {
  return {
    uid: user.uid,
    displayName: user.displayName || user.email || "Signed in",
    email: user.email ?? "",
    photoURL: user.photoURL ?? null,
  };
}
