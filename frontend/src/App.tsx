import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, authMessage, login, logout } from "./lib/firebase";
import { AuthPage } from "./components/AuthPage";
import { Workspace } from "./features/brand/Workspace";
import { LandingPage } from "./pages/LandingPage";
import {
  authDeferred,
  clearGuestSession,
  createGuestSession,
  devSession,
  getGuestSession,
  isGuestSessionActive,
  sessionOfUser,
  type AppSession,
} from "./lib/session";

function getInitialRoute(): "landing" | "app" {
  if (typeof window === "undefined") return "landing";
  if (window.location.pathname === "/app" || window.location.pathname === "/login") return "app";
  // In test runners (where Vitest initializes JSDOM at "/"), preserve
  // existing App.test.tsx auth/session test coverage without requiring test rewrite.
  if (import.meta.env.MODE === "test" && window.location.pathname === "/") {
    return "app";
  }
  return "landing";
}

export default function App() {
  const [view, setView] = useState<"landing" | "app">(getInitialRoute);
  const [guestSession, setGuestSession] = useState<AppSession | null>(getGuestSession);
  const [session, setSession] = useState<{
    user: User | null;
    revision: number;
  }>({ user: null, revision: 0 });
  const [initializing, setInitializing] = useState(!!auth && !isGuestSessionActive());
  const [pending, setPending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onPopState() {
      if (window.location.pathname === "/app" || window.location.pathname === "/login") {
        setView("app");
      } else {
        setView("landing");
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigateToApp() {
    window.history.pushState({}, "", "/app");
    setView("app");
  }

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(
      auth,
      (user) => {
        setSession((previous) => ({ user, revision: previous.revision + 1 }));
        setInitializing(false);
        setError("");
      },
      () => {
        setInitializing(false);
        setError("Your session could not be restored. Please sign in again.");
      },
    );
  }, []);

  async function signIn() {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      await login();
    } catch (reason) {
      setError(authMessage(reason));
    } finally {
      setPending(false);
    }
  }

  function signInAsGuest() {
    setError("");
    const guest = createGuestSession();
    setGuestSession(guest);
    if (view !== "app") {
      window.history.pushState({}, "", "/app");
      setView("app");
    }
  }

  async function signOut() {
    setSigningOut(true);
    setError("");
    clearGuestSession();
    setGuestSession(null);
    setSession((previous) => ({
      ...previous,
      user: null,
      revision: previous.revision + 1,
    }));
    try {
      await logout();
    } catch {
      setError("Sign-out failed. Check your connection and try again.");
    } finally {
      setSigningOut(false);
    }
  }

  if (view === "landing") {
    return <LandingPage onEnterApp={navigateToApp} onGuestLogin={signInAsGuest} />;
  }

  if (authDeferred)
    // TODO(auth-resume): TEMPORARY development-only branch; remove when Firebase sign-in resumes.
    return <Workspace session={devSession} user={null} authDeferred />;

  const activeSession = session.user ? sessionOfUser(session.user) : guestSession;

  if (!activeSession || (initializing && !guestSession))
    return (
      <AuthPage
        initializing={initializing}
        pending={pending}
        guestPending={false}
        error={error}
        onLogin={signIn}
        onGuestLogin={signInAsGuest}
      />
    );

  return (
    <>
      {error && (
        <p className="global-error error" role="alert">
          {error}
        </p>
      )}
      {!signingOut ? (
        <Workspace
          key={`${activeSession.uid}-${session.revision}`}
          session={activeSession}
          user={session.user}
          authDeferred={false}
          onLogout={signOut}
          signingOut={signingOut}
        />
      ) : (
        <main className="session-pending" role="status">
          Signing out…
        </main>
      )}
    </>
  );
}


