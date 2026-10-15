import { useState } from "react";
import { getThemePref, setThemePref } from "../lib/theme";
import type { ThemePref } from "../lib/theme";
import "./ThemeToggle.css";

const ORDER: ThemePref[] = ["system", "light", "dark"];
const LABEL: Record<ThemePref, string> = {
  system: "Automatic",
  light: "Light",
  dark: "Dark",
};

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);

  function next() {
    const n = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setThemePref(n);
    setPref(n);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={next}
      aria-label={`Theme: ${LABEL[pref]}. Tap to change.`}
      title={`Theme: ${LABEL[pref]}`}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {pref === "light" && (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </>
        )}
        {pref === "dark" && <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />}
        {pref === "system" && (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" />
          </>
        )}
      </svg>
    </button>
  );
}
