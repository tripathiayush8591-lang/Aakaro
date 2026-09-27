import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInAnonymously,
  signInWithPopup,
  signOut,
  type Auth,
} from "firebase/auth";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
export const missingFirebaseFields = Object.entries(config)
  .filter(([, value]) => !value || value.startsWith("replace-with-"))
  .map(([key]) => key);
function initializeAuth(): Auth | null {
  if (missingFirebaseFields.length) return null;
  try {
    return getAuth(getApps()[0] ?? initializeApp(config));
  } catch {
    return null;
  }
}
export const auth = initializeAuth();
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });
let loginInProgress = false;
async function guardedSignIn(signIn: (instance: Auth) => Promise<unknown>) {
  if (!auth)
    throw new Error(
      "Sign-in is not configured yet. Please contact the app owner.",
    );
  if (loginInProgress) return;
  loginInProgress = true;
  try {
    await signIn(auth);
  } finally {
    loginInProgress = false;
  }
}
export async function login() {
  await guardedSignIn((instance) => signInWithPopup(instance, provider));
}
// Real Firebase anonymous session: the guest receives an anonymous UID and a
// genuine ID token verified by the backend like any other sign-in provider.
export async function loginAsGuest() {
  await guardedSignIn((instance) => signInAnonymously(instance));
}
export async function logout() {
  if (auth) await signOut(auth);
}
export function authMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : "";
  if (
    code === "auth/popup-closed-by-user" ||
    code === "auth/cancelled-popup-request"
  )
    return "Sign-in was cancelled. You can try again when you’re ready.";
  if (code === "auth/popup-blocked")
    return "Allow pop-ups for this site, then try Google sign-in again.";
  if (code === "auth/network-request-failed")
    return "Check your internet connection and try again.";
  if (code === "auth/unauthorized-domain")
    return "This domain is not authorized for Google sign-in. Check Firebase configuration.";
  if (code === "auth/operation-not-allowed")
    return "Guest sign-in is not enabled for this app yet. Please contact the app owner.";
  if (code === "auth/too-many-requests")
    return "Too many sign-in attempts. Please wait a moment and try again.";
  if (!auth)
    return "Sign-in is not configured yet. Please contact the app owner.";
  return "Sign-in could not be completed. Try again, or contact the app owner if this continues.";
}
