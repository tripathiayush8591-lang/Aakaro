import { STAGE_STEPS, stageStep, type ProjectStage } from "../../types/project";

const STEP_INDEX = new Map<string, number>(
  STAGE_STEPS.map((step, index) => [step.id, index]),
);

export function StageRail({
  stage,
  completed,
}: {
  stage: ProjectStage;
  completed: Set<string>;
}) {
  const current = stageStep(stage);
  const currentIndex = STEP_INDEX.get(current) ?? 0;
  return (
    <nav className="stage-rail" aria-label="Brand journey stages">
      {STAGE_STEPS.map((step, index) => {
        const isCurrent = step.id === current;
        const isDone = index < currentIndex || completed.has(step.id);
        const state = isCurrent ? "current" : isDone ? "done" : "upcoming";
        return (
          <div
            key={step.id}
            className={`stage-step ${state}`}
            aria-current={isCurrent ? "step" : undefined}
          >
            <span className="stage-dot" aria-hidden="true">
              {isDone && !isCurrent ? (
                <svg viewBox="0 0 16 16" width="10" height="10">
                  <path
                    d="M3 8.4 6.4 11.6 13 4.8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
            <span className="stage-label">{step.label}</span>
            {index < STAGE_STEPS.length - 1 && (
              <span className="stage-connector" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </nav>
  );
}
