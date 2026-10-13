import { Link } from "react-router-dom";
import { formatClock } from "../lib/format";
import { useSession } from "../session/useSession";

export default function TimerCard({ roomId }: { roomId: string }) {
  const t = useSession();
  const { session } = t;
  const here = session !== null && String(session.room_id) === roomId;
  const elsewhere = session !== null && !here;

  const label = here ? (t.running ? "Focusing" : "Paused") : "Ready";
  const pct = here ? ((t.seconds % 3600) / 3600) * 100 : 0;
  const ringColor = t.running ? "var(--lime)" : "var(--amber)";

  return (
    <section className="timer" aria-label="My timer">
      <div className="timer__top">
        <h2 className="timer__title">My timer</h2>
        <span
          className={`state-badge ${
            here ? (t.running ? "state-badge--focusing" : "state-badge--on_break") : ""
          }`}
        >
          {label}
        </span>
      </div>

      <div className="timer__body">
        <div
          className="timer__ring"
          style={{
            background: `conic-gradient(${ringColor} 0 ${pct}%, var(--surface-raised) ${pct}% 100%)`,
          }}
          aria-hidden="true"
        >
          <div className="timer__ring-inner" />
        </div>
        <div>
          <div className="timer__digits" aria-live="off">
            {here ? formatClock(t.seconds) : "0:00"}
          </div>
          <div className="timer__sub">Recorded timer time</div>
        </div>
      </div>

      {elsewhere && session && (
        <div className="notice">
          A timer is already running in another room.{" "}
          <Link to={`/rooms/${session.room_id}`} style={{ color: "var(--cyan)" }}>
            Go to that room
          </Link>
        </div>
      )}

      {(t.error || t.notice) && (
        <div
          className={t.error ? "error-box" : "notice"}
          role={t.error ? "alert" : "status"}
        >
          {t.error ?? t.notice}
        </div>
      )}

      <div className="timer__actions">
        {session === null ? (
          <button
            type="button"
            className="btn-primary timer__start"
            disabled={t.busy || t.loading}
            onClick={() => t.start(roomId)}
          >
            {t.busy ? "Starting…" : "Start focusing"}
          </button>
        ) : (
          <>
            {here &&
              (t.running ? (
                <button
                  type="button"
                  className="timer__btn timer__btn--amber"
                  disabled={t.busy}
                  onClick={t.pause}
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="timer__btn timer__btn--lime"
                  disabled={t.busy}
                  onClick={t.resume}
                >
                  Resume
                </button>
              ))}
            <button
              type="button"
              className="timer__btn timer__btn--raised"
              disabled={t.busy}
              onClick={t.finish}
            >
              {elsewhere ? "Finish that timer" : "Finish"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}