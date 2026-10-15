import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { ApiError, api } from "../lib/api";
import { avatarColor, formatDayShort, formatTotal } from "../lib/format";
import type {
  Leaderboard as LeaderboardData,
  LeaderboardPeriod,
} from "../lib/types";
import "./Leaderboard.css";

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
];
const REFRESH_MS = 30_000;

function sinceText(data: LeaderboardData): string {
  if (data.period === "today") return "Since midnight, India time";
  return `Since ${formatDayShort(data.since)}, India time`;
}

export default function Leaderboard({ roomId }: { roomId: string }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    async function load() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const d = await api<LeaderboardData>(
          `/rooms/${roomId}/leaderboard?period=${period}`,
        );
        if (cancelled) return;
        setData(d);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : "Something went wrong.");
      } finally {
        inFlight = false;
      }
    }

    load();
    const id = setInterval(load, REFRESH_MS);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [roomId, period]);

  const shown = data && data.period === period ? data : null;
  const top = shown ? Math.max(0, ...shown.members.map((m) => m.seconds)) : 0;

  return (
    <section className="lb" aria-label="Leaderboard">
      <div className="section-head">
        <h2>Leaderboard</h2>
        <span>Updates every 30 seconds</span>
      </div>

      <div className="lb__tabs" role="tablist" aria-label="Period">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="tab"
            className="lb__tab"
            aria-selected={period === p.key}
            onClick={() => setPeriod(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}

      {shown === null ? (
        !error && <div className="notice">Loading...</div>
      ) : (
        <>
          <ol className="lb__list">
            {shown.members.map((m) => {
              const isMe = m.user_id === user?.id;
              const pct = top > 0 ? Math.round((m.seconds / top) * 100) : 0;
              return (
                <li
                  key={m.user_id}
                  className={`lb__row ${isMe ? "lb__row--me" : ""}`}
                >
                  <span
                    className={`lb__rank ${
                      m.rank !== null && m.rank <= 3 ? `lb__rank--${m.rank}` : ""
                    }`}
                    aria-label={m.rank === null ? "Unranked" : `Rank ${m.rank}`}
                  >
                    {m.rank ?? "-"}
                  </span>
                  <span
                    className="lb__avatar"
                    style={{ background: avatarColor(m.user_id) }}
                    aria-hidden="true"
                  >
                    {m.username.charAt(0).toUpperCase()}
                  </span>
                  <span className="lb__main">
                    <span className="lb__name">
                      {m.username}
                      {isMe ? " (you)" : ""}
                    </span>
                    <span className="lb__bar" aria-hidden="true">
                      <span className="lb__fill" style={{ width: `${pct}%` }} />
                    </span>
                  </span>
                  <strong className="lb__time">
                    {m.seconds > 0 ? formatTotal(m.seconds) : "-"}
                  </strong>
                </li>
              );
            })}
          </ol>
          <div className="lb__since">{sinceText(shown)}</div>
        </>
      )}
    </section>
  );
}
