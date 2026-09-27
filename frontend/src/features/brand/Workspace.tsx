import { useMemo, type Dispatch, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { useAakaroProject, type ProjectAction } from "../../lib/project";
import type { AppSession } from "../../lib/session";
import type { AakaroProject } from "../../types/project";
import { ThemeToggle } from "../../components/ThemeToggle";
import { StageRail } from "./StageRail";
import { IdeaScreen } from "./IdeaScreen";
import { ClarifyScreen } from "./ClarifyScreen";
import { NamingGraveyard, NamingScreen } from "./NamingScreen";
import { DirectionsScreen } from "./DirectionsScreen";
import { StrategyScreen } from "./StrategyScreen";

function screenFor(
  project: AakaroProject,
  dispatch: Dispatch<ProjectAction>,
  user: User | null,
): ReactNode {
  switch (project.currentStage) {
    case "idea":
      return <IdeaScreen idea={project.idea.rawIdea} dispatch={dispatch} />;
    case "clarification":
      return <ClarifyScreen project={project} dispatch={dispatch} user={user} />;
    case "strategy":
      return <StrategyScreen project={project} dispatch={dispatch} user={user} />;
    case "naming":
      // Naming consumes only the confirmed strategy; without one, the
      // strategy screen is the recovery path.
      return project.strategy.confirmed ? (
        <NamingScreen project={project} dispatch={dispatch} user={user} />
      ) : (
        <StrategyScreen project={project} dispatch={dispatch} user={user} />
      );
    case "directions":
      return <DirectionsScreen project={project} dispatch={dispatch} user={user} />;
    default:
      return <DirectionsScreen project={project} dispatch={dispatch} user={user} />;
  }
}

export function Workspace({
  session,
  user,
  authDeferred,
  onLogout,
  signingOut,
}: {
  session: AppSession;
  user: User | null;
  authDeferred: boolean;
  onLogout?: () => void;
  signingOut?: boolean;
}) {
  const { project, dispatch, storageWarning, resetProject } = useAakaroProject(
    session.uid,
  );
  const completedStages = useMemo(() => {
    const done = new Set<string>();
    if (project.idea.rawIdea.trim()) done.add("idea");
    if (project.clarification.completed) done.add("clarification");
    if (project.strategy.confirmed) done.add("strategy");
    if (project.naming.generationStatus === "confirmed") done.add("naming");
    return done;
  }, [
    project.idea.rawIdea,
    project.clarification.completed,
    project.strategy.confirmed,
    project.naming.generationStatus,
  ]);
  return (
    <div className="shell">
      <header className="navbar">
        <div className="navbar-inner">
          <div className="brand">
            <span className="wordmark">aakaro</span>
            <span className="brand-tag">Give your idea an identity.</span>
          </div>
          <div className="navbar-actions">
            {authDeferred && (
              <span className="dev-badge">Dev preview · mock AI</span>
            )}
            <ThemeToggle />
            <button
              className="text-button"
              onClick={() => {
                if (
                  window.confirm(
                    "Start over? This clears this project from this browser.",
                  )
                )
                  resetProject();
              }}
            >
              Start over
            </button>
            <div className="session">
              <span className="session-name">{session.displayName}</span>
              {session.email && (
                <small className="session-detail">{session.email}</small>
              )}
            </div>
            {onLogout && (
              <button
                className="btn btn-secondary btn-small"
                onClick={onLogout}
                disabled={signingOut}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="app-main">
        <StageRail stage={project.currentStage} completed={completedStages} />
        {storageWarning && (
          <p className="error" role="alert">
            {storageWarning}
          </p>
        )}
        {screenFor(project, dispatch, user)}
        {(project.currentStage === "directions" || project.currentStage === "brand-kit") &&
          project.naming.generationStatus === "confirmed" && <NamingGraveyard project={project} />}
      </main>
    </div>
  );
}
