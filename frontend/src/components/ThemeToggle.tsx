import { useTheme } from "../lib/theme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const nextTheme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${nextTheme} theme`}
      aria-pressed={theme === "dark"}
      title={`Switch to ${nextTheme} theme`}
    >
      <span className="theme-toggle-option" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <circle cx="12" cy="12" r="4.4" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
          </g>
        </svg>
      </span>
      <span className="theme-toggle-option" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14">
          <path
            fill="currentColor"
            d="M20.4 14.2A8.6 8.6 0 0 1 9.8 3.6 8.6 8.6 0 1 0 20.4 14.2Z"
          />
        </svg>
      </span>
      <span className="theme-toggle-thumb" aria-hidden="true" />
    </button>
  );
}
