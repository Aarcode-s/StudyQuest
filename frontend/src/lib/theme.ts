export type ThemePref = "system" | "light" | "dark";
export type ThemeResolved = "light" | "dark";

const KEY = "sq_theme";
const BROWSER_COLOR: Record<ThemeResolved, string> = {
  dark: "#000000",
  light: "#EEEEED",
};

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage unavailable */
  }
  return "dark";
}

export function resolveTheme(pref: ThemePref): ThemeResolved {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function setBrowserThemeColor(color: string) {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", color);
}

export function applyTheme(pref: ThemePref) {
  const resolved = resolveTheme(pref);
  document.documentElement.dataset.theme = resolved;
  setBrowserThemeColor(BROWSER_COLOR[resolved]);
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* ignore */
  }
  applyTheme(pref);
}

export function initTheme() {
  applyTheme(getThemePref());
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", () => {
      if (getThemePref() === "system") applyTheme("system");
    });
}
