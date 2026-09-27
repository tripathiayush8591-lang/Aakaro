import { auth } from "./firebase";

/** A lightweight session identity, independent of Firebase specifics. */
export interface AppSession {
  uid: string;
  displayName: string;
  email: string;
}

// TODO(auth-resume): TEMPORARY development-only session used while Firebase
// Google sign-in is deferred. Active only when all of the following hold:
// a development build, VITE_DEV_AUTH_BYPASS=1, and Firebase is unconfigured.
// It can never appear in a production build. Remove this flag and constant
// (and the App.tsx branch) when authentication resumes.
export const authDeferred =
  import.meta.env.DEV &&
  import.meta.env.VITE_DEV_AUTH_BYPASS === "1" &&
  auth === null;

export const DEV_UID = "dev-local";

export const devSession: AppSession = {
  uid: DEV_UID,
  displayName: "Local session",
  email: "Sign-in arrives with the next milestone",
};

export function sessionOfUser(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
}): AppSession {
  return {
    uid: user.uid,
    displayName: user.displayName || user.email || "Signed in",
    email: user.email ?? "",
  };
}
