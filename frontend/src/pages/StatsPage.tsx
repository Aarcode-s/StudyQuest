import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StreakGrid from "../components/StreakGrid";
import { ApiError, api } from "../lib/api";
import { formatTotal } from "../lib/format";
import type { DailyStats } from "../lib/types";
import "./stats.css";

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function StatsPage() {
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<DailyStats>("/stats/daily?days=365")
      .then((s) => {
        if (!cancelled) {
          setStats(s);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof ApiError ? e.message : "Something went wrong.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const minutes = stats ? Math.round(stats.streak_min_seconds / 60) : 10;

  return (
    <main className="screen stats">
      <header className="stats__head">
        <Link to="/rooms" className="icon-btn" aria-label="Back to rooms">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="title stats__title">Your focus</h1>
      </header>

      {error && (
        <div className="panel">
          <div className="error-box" role="alert">
            {error}
          </div>
          <button
            type="button"
            className="btn-outline"
            onClick={() => {
              setError(null);
              setReloadKey((k) => k + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}

      {!stats && !error && <div className="notice">Loading...</div>}

      {stats && (
        <>
          <div className="stats__tiles">
            <div className="tile tile--hero">
              <small>Current streak</small>
              <strong>{plural(stats.current_streak, "day")}</strong>
            </div>
            <div className="tile">
              <small>Longest streak</small>
              <strong>{plural(stats.longest_streak, "day")}</strong>
            </div>
            <div className="tile">
              <small>Active days</small>
              <strong>{stats.active_days}</strong>
            </div>
            <div className="tile">
              <small>Total time</small>
              <strong>{formatTotal(stats.total_seconds)}</strong>
            </div>
          </div>

          <section className="stats__card" aria-label="Daily focus grid">
            <div className="section-head">
              <h2>Last 12 months</h2>
              <span>India time</span>
            </div>
            <StreakGrid days={stats.days} minSeconds={stats.streak_min_seconds} />
          </section>

          <p className="footnote">
            A day counts toward your streak when you record at least {minutes}{" "}
            minutes. Your streak stays alive until the end of today, so a day
            without a timer only breaks it once the day is over. A session
            counts for the day it started. Times are recorded timer time, not
            verified productivity.
          </p>
        </>
      )}
    </main>
  );
}
