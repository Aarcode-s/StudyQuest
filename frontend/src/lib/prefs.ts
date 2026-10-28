import { useSyncExternalStore } from "react";

export type Prefs = {
  focusMin: number;
  breakMin: number;
  rounds: number; // focus rounds before the long break
  longBreakMin: number;
  autoStartBreaks: boolean;
  sound: boolean;
  vibrate: boolean;
  tone: string; // alarm sound id
  swap: boolean; // Pomodoro is the big clock
  lastRoomId: number | null;
  tag: string | null;
  customTags: string[];
};

const KEY = "sq_prefs";
export const DEFAULT_TAGS = ["Study", "Project", "Revision", "Reading"];

const DEFAULTS: Prefs = {
  focusMin: 25,
  breakMin: 5,
  rounds: 4,
  longBreakMin: 20,
  autoStartBreaks: true,
  sound: true,
  vibrate: true,
  tone: "beep",
  swap: false,
  lastRoomId: null,
  tag: "Study",
  customTags: [],
};

function load(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    /* ignore */
  }
  return DEFAULTS;
}

let current: Prefs = load();
const listeners = new Set<() => void>();

export function getPrefs(): Prefs {
  return current;
}

export function setPrefs(patch: Partial<Prefs>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}
