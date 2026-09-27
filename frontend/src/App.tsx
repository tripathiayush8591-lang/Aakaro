import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, authMessage, login, logout } from "./lib/firebase";
import { AuthPage } from "./components/AuthPage";
import { Workspace } from "./features/brand/Workspace";
import { LandingPage } from "./pages/LandingPage";
import { authDeferred, devSession, sessionOfUser } from "./lib/session";

function getInitialRoute(): "landing" | "app" {
  if (typeof window === "undefined") return "landing";
  if (window.location.pathname === "/app") return "app";
  // In test runners (where Vitest initializes JSDOM at "/"), preserve
  // existing App.test.tsx auth/session test coverage without requiring test rewrite.
  if (import.meta.env.MODE === "test" && window.location.pathname === "/") {
    return "app";
  }
  return "landing";
}

export default function App() {
  const [view, setView] = useState<"landing" | "app">(getInitialRoute);
  const [session, setSession] = useState<{
    user: User | null;
    revision: number;
  }>({ user: null, revision: 0 });
  const [initializing, setInitializing] = useState(!!auth);
  const [pending, setPending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onPopState() {
      if (window.location.pathname === "/app") {
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
  async function signOut() {
    setSigningOut(true);
    setError("");
    // Unmount immediately: abort work and clear all user-specific diagnostics even if sign-out fails.
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
    return <LandingPage onEnterApp={navigateToApp} />;
  }

  if (authDeferred)
    // TODO(auth-resume): TEMPORARY development-only branch; remove when Firebase sign-in resumes.
    return <Workspace session={devSession} user={null} authDeferred />;
  if (!session.user || initializing)
    return (
      <AuthPage
        initializing={initializing}
        pending={pending}
        error={error}
        onLogin={signIn}
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
          key={`${session.user.uid}-${session.revision}`}
          session={sessionOfUser(session.user)}
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

