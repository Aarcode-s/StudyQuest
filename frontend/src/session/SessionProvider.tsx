import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ApiError, api } from "../lib/api";
import type { Session } from "../lib/types";
import { SessionContext, isRunning } from "./context";

const HEARTBEAT_MS = 30_000;
const MAX_DRIFT_SECONDS = 95; // the server stops counting ~90s after a missed heartbeat

function errText(e: unknown): string {
  return e instanceof ApiError ? e.message : "Something went wrong.";
}

function driftSince(at: number): number {
  return Math.min(
    MAX_DRIFT_SECONDS,
    Math.max(0, Math.floor((Date.now() - at) / 1000)),
  );
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  const sessionRef = useRef<Session | null>(null);
  const fetchedAtRef = useRef(0);

  const applySession = useCallback((s: Session | null) => {
    const t = Date.now();
    sessionRef.current = s;
    fetchedAtRef.current = t;
    setSession(s);
    setFetchedAt(t);
    setNow(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      applySession(await api<Session | null>("/sessions/active"));
    } catch (e) {
      setError(errText(e));
    }
  }, [applySession]);

  // First load
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const running = isRunning(session);
  const sessionId = session?.id;

  // 1-second tick, only while a timer is running
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Heartbeat every 30s while running and the app is visible
  const expire = useCallback(
    async (id: number) => {
      try {
        await api(`/sessions/${id}/finish`, { method: "POST" });
      } catch {
        /* finish is idempotent; ignore */
      }
      applySession(null);
      setNotice(
        "Your timer stopped because the app lost contact with the server. Time up to the last signal was kept.",
      );
    },
    [applySession],
  );

  useEffect(() => {
    if (!running || sessionId === undefined) return;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const s = await api<Session>(`/sessions/${sessionId}/heartbeat`, {
          method: "POST",
        });
        if (s && typeof s.focus_seconds === "number") applySession(s);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409 && !document.hidden) {
          await expire(sessionId);
        }
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [running, sessionId, applySession, expire]);

  // Leaving the app pauses a running timer; coming back re-syncs
  useEffect(() => {
    function onVisibility() {
      if (document.hidden) {
        const s = sessionRef.current;
        if (isRunning(s)) {
          const shown = s.focus_seconds + driftSince(fetchedAtRef.current);
          applySession({
            ...s,
            focus_seconds: shown,
            paused_at: new Date().toISOString(),
          });
          api(`/sessions/${s.id}/pause`, {
            method: "POST",
            keepalive: true,
          }).catch(() => {});
        }
      } else {
        refresh();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [applySession, refresh]);

  const run = useCallback(
    async (fn: () => Promise<Session | null>) => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        applySession(await fn());
      } catch (e) {
        setError(errText(e));
        await refresh();
      } finally {
        setBusy(false);
      }
    },
    [applySession, refresh],
  );

  const start = useCallback(
    (roomId: string | number) =>
      run(() => api<Session>(`/rooms/${roomId}/sessions`, { method: "POST" })),
    [run],
  );

  const act = useCallback(
    (action: "pause" | "resume") =>
      run(async () => {
        const s = sessionRef.current;
        if (!s) throw new ApiError(0, "No active timer.");
        return api<Session>(`/sessions/${s.id}/${action}`, { method: "POST" });
      }),
    [run],
  );

  const finish = useCallback(
    () =>
      run(async () => {
        const s = sessionRef.current;
        if (!s) return null;
        await api(`/sessions/${s.id}/finish`, { method: "POST" });
        return null;
      }),
    [run],
  );

  const drift = running ? driftSince(fetchedAt) : 0;
  void now; // re-render each second while running; drift reads the clock
  const seconds = session ? session.focus_seconds + drift : 0;

  return (
    <SessionContext.Provider
      value={{
        session,
        loading,
        busy,
        error,
        notice,
        running,
        seconds,
        start,
        pause: () => act("pause"),
        resume: () => act("resume"),
        finish,
        dismiss: () => {
          setError(null);
          setNotice(null);
        },
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}