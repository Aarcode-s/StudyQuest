export type ThemePref = "system" | "light" | "dark";
export type ThemeResolved = "light" | "dark";

const KEY = "sq_theme";
const BROWSER_COLOR: Record<ThemeResolved, string> = {
  dark: "#0A0A0A",
  light: "#FFF6EC",
};

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* storage unavailable: fall through to the default */
  }
  return "system";
}

export function resolveTheme(pref: ThemePref): ThemeResolved {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** Colours the phone's status bar / browser toolbar. */
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
    /* ignore: the choice just won't be remembered */
  }
  applyTheme(pref);
}

/** Call once at startup. Also follows the phone's setting while on "system". */
export function initTheme() {
  applyTheme(getThemePref());
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", () => {
      if (getThemePref() === "system") applyTheme("system");
    });
}
