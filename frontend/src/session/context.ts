import { createContext } from "react";
import type { PauseReason, Session } from "../lib/types";

export type PomoPhase = "focus" | "break";

export type PomoView = {
  phase: PomoPhase;
  round: number;
  rounds: number;
  long: boolean; // the current/next break is the long one
  /** Seconds left in the current focus block or break. */
  remaining: number;
  /** 0..1 progress through the current block. */
  frac: number;
};

export type SessionState = {
  session: Session | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  running: boolean;
  /** True when the server session is paused by a Pomodoro break. */
  onBreak: boolean;
  seconds: number; // focus seconds to display right now
  pomo: PomoView;
  start: (roomId: string | number, tag?: string | null) => Promise<void>;
  pause: (reason?: PauseReason) => Promise<void>;
  resume: () => Promise<void>;
  /** Ends the session and returns it (for the end-of-session sheet). */
  finish: () => Promise<Session | null>;
  skipBreak: () => void;
  dismiss: () => void;
};

export const SessionContext = createContext<SessionState | null>(null);

export function isRunning(s: Session | null): s is Session {
  return s !== null && s.ended_at === null && s.paused_at === null;
}
