import { createContext } from "react";
import type { Session } from "../lib/types";

export type SessionState = {
  session: Session | null;
  loading: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
  running: boolean;
  seconds: number; // focus seconds to display right now
  start: (roomId: string | number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  finish: () => Promise<void>;
  dismiss: () => void;
};

export const SessionContext = createContext<SessionState | null>(null);

export function isRunning(s: Session | null): s is Session {
  return s !== null && s.ended_at === null && s.paused_at === null;
}