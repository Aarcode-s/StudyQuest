import { useCallback, useEffect, useRef, useState } from "react";
import { signal } from "../lib/beep";
import { usePrefs } from "../lib/prefs";
import type { PauseReason, Session } from "../lib/types";
import type { PomoView } from "./context";

type Stored = {
  sessionId: number;
  round: number;
  phase: "focus" | "break";
  focusBase: number; // session seconds when this focus block began
  breakStartedAt: number; // ms
  breakLen: number; // seconds
  long: boolean;
};

const KEY = "sq_pomo";

function load(sessionId: number): Stored | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    return s.sessionId === sessionId ? s : null;
  } catch {
    return null;
  }
}
function save(s: Stored | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * The Pomodoro cycle. Focus progress comes from the server session seconds,
 * so pausing and leaving the app naturally hold it. A break pauses the server
 * session (friends see "On break") with the reason "pomodoro".
 */
export function usePomodoro(
  session: Session | null,
  seconds: number,
  running: boolean,
  pause: (reason: PauseReason) => Promise<void>,
  resume: () => Promise<void>,
): { view: PomoView; skipBreak: () => void; onBreak: boolean } {
  const prefs = usePrefs();
  const [state, setState] = useState<Stored | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const busyRef = useRef(false);
  const sessionId = session?.id;

  // Load or create the cycle for this session.
  useEffect(() => {
    if (sessionId === undefined) {
      setState(null);
      save(null);
      return;
    }
    const existing = load(sessionId);
    if (existing) {
      setState(existing);
      return;
    }
    const fresh: Stored = {
      sessionId,
      round: 1,
      phase: "focus",
      // Joining mid-session (new device): count from the last full block.
      focusBase:
        Math.floor((session?.focus_seconds ?? 0) / (prefs.focusMin * 60)) *
        (prefs.focusMin * 60),
      breakStartedAt: 0,
      breakLen: 0,
      long: false,
    };
    // Join a session already in progress (for example after a reload).
    save(fresh);
    setState(fresh);
  }, [sessionId]);

  const update = useCallback((s: Stored) => {
    save(s);
    setState(s);
  }, []);

  const onBreak = state?.phase === "break";

  // Re-render each second during a break (the session itself is paused then).
  useEffect(() => {
    if (!onBreak) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [onBreak]);

  const focusLen = prefs.focusMin * 60;

  useEffect(() => {
    if (!state || !session || busyRef.current) return;

    if (state.phase === "focus" && running) {
      if (seconds - state.focusBase >= focusLen) {
        const long = state.round >= prefs.rounds;
        const breakLen = (long ? prefs.longBreakMin : prefs.breakMin) * 60;
        busyRef.current = true;
        signal(prefs.sound, prefs.vibrate, prefs.tone);
        update({ ...state, phase: "break", breakStartedAt: Date.now(), breakLen, long });
        pause("pomodoro").finally(() => {
          busyRef.current = false;
        });
      }
    } else if (state.phase === "break") {
      const left = state.breakLen - (Date.now() - state.breakStartedAt) / 1000;
      if (left <= 0) {
        busyRef.current = true;
        signal(prefs.sound, prefs.vibrate, prefs.tone);
        const next: Stored = {
          ...state,
          phase: "focus",
          round: state.long ? 1 : state.round + 1,
          focusBase: session.focus_seconds,
          long: false,
        };
        update(next);
        const done = () => {
          busyRef.current = false;
        };
        if (prefs.autoStartBreaks) resume().finally(done);
        else done();
      }
    }
  }, [state, session, running, seconds, tick, focusLen, prefs, pause, resume, update]);

  const skipBreak = useCallback(() => {
    if (!state || !session || state.phase !== "break") return;
    update({
      ...state,
      phase: "focus",
      round: state.long ? 1 : state.round + 1,
      focusBase: session.focus_seconds,
      long: false,
    });
    void resume();
  }, [state, session, update, resume]);

  let view: PomoView;
  if (state?.phase === "break") {
    const left = Math.max(
      0,
      Math.ceil(state.breakLen - (Date.now() - state.breakStartedAt) / 1000),
    );
    view = {
      phase: "break",
      round: state.round,
      rounds: prefs.rounds,
      long: state.long,
      remaining: left,
      frac: state.breakLen > 0 ? 1 - left / state.breakLen : 0,
    };
  } else {
    const done = state ? Math.max(0, seconds - state.focusBase) : 0;
    const left = Math.max(0, focusLen - done);
    view = {
      phase: "focus",
      round: state?.round ?? 1,
      rounds: prefs.rounds,
      long: (state?.round ?? 1) >= prefs.rounds,
      remaining: left,
      frac: focusLen > 0 ? Math.min(1, done / focusLen) : 0,
    };
  }
  return { view, skipBreak, onBreak: !!onBreak };
}
