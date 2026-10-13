import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { formatClock } from "../lib/format";
import type { Room } from "../lib/types";
import { useWakeLock } from "../hooks/useWakeLock";
import { useSession } from "../session/useSession";
import "./dock.css";

export default function DockPage() {
  const { roomId = "" } = useParams();
  const navigate = useNavigate();
  const t = useSession();
  const wake = useWakeLock(true);

  const [room, setRoom] = useState<Room | null>(null);
  const [isFs, setIsFs] = useState(() => !!document.fullscreenElement);

  // Room name is cosmetic, so a failure here is ignored.
  useEffect(() => {
    let cancelled = false;
    api<Room>(`/rooms/${roomId}`)
      .then((r) => {
        if (!cancelled) setRoom(r);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [roomId]);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
      const o = screen.orientation as unknown as {
        lock?: (orientation: string) => Promise<void>;
      };
      await o.lock?.("landscape");
    } catch {
      /* unsupported or refused: dock mode still works without it */
    }
  }

  async function exit() {
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
    }
    navigate(`/rooms/${roomId}`);
  }

  const { session } = t;
  const here = session !== null && String(session.room_id) === roomId;
  const elsewhere = session !== null && !here;
  const label = here ? (t.running ? "Focusing" : "Paused") : "Ready";
  const wakeNote = !wake.supported
    ? "This browser can't keep the screen awake."
    : wake.held
      ? "Screen stays awake. Recorded timer time."
      : "Asking the browser to keep the screen awake…";

  return (
    <main className="dock">
      <div className="dock__top">
        <div className="dock__who">
          <span
            className={`state-badge ${
              here ? (t.running ? "state-badge--focusing" : "state-badge--on_break") : ""
            }`}
          >
            {label}
          </span>
          <span className="dock__room">{room?.name ?? ""}</span>
        </div>
        <div className="dock__tools">
          {document.fullscreenEnabled && !isFs && (
            <button
              type="button"
              className="icon-btn"
              aria-label="Go fullscreen"
              onClick={enterFullscreen}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#E9E2FF"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            aria-label="Exit dock mode"
            onClick={exit}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E9E2FF"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <div>
        <div
          className={
            t.seconds >= 3600 ? "dock__digits dock__digits--long" : "dock__digits"
          }
        >
          {here ? formatClock(t.seconds) : "0:00"}
        </div>
        {elsewhere && session && (
          <div className="dock__msg">
            A timer is running in another room.{" "}
            <Link to={`/rooms/${session.room_id}/dock`} style={{ color: "var(--cyan)" }}>
              Open it
            </Link>
          </div>
        )}
        {(t.error || t.notice) && (
          <div className="dock__msg" role={t.error ? "alert" : "status"}>
            {t.error ?? t.notice}
          </div>
        )}
        <div className="dock__rotate">Rotate your phone to landscape.</div>
      </div>

      <div className="dock__bottom">
        <div className="dock__note">{wakeNote}</div>
        <div className="dock__actions">
          {session === null ? (
            <button
              type="button"
              className="btn-primary"
              disabled={t.busy || t.loading}
              onClick={() => t.start(roomId)}
            >
              Start focusing
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
                Finish
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}