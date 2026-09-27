import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const THEME_KEY = "aakaro:theme";

function initialTheme(): Theme {
  const current = document.documentElement.dataset.theme;
  return current === "dark" ? "dark" : "light";
}

/** Theme state backed by <html data-theme>, localStorage, and system preference. */
export function useTheme(): {
  theme: Theme;
  toggle: () => void;
} {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        // Preference is best-effort; the session theme still applies.
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
