import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatClock } from "../lib/format";
import { applyTheme, getThemePref, setBrowserThemeColor } from "../lib/theme";
import { useWakeLock } from "../hooks/useWakeLock";
import { useSession } from "../session/useSession";
import "./dock.css";

const CONTROLS_MS = 6000; // how long the controls stay after a tap
const SHIFT_MS = 60_000; // nudge the clock slightly now and then (OLED burn-in)
const SHIFTS = [
  [0, 0],
  [8, -6],
  [-8, 6],
  [6, 8],
  [-6, -8],
];

export default function DockPage() {
  const { roomId = "" } = useParams();
  const navigate = useNavigate();
  const t = useSession();
  const wake = useWakeLock(true);

  const [controls, setControls] = useState(false);
  const [isFs, setIsFs] = useState(() => !!document.fullscreenElement);
  const [shift, setShift] = useState(0);
  const hideTimer = useRef<number | undefined>(undefined);

  // Black status bar while docked; restore the theme colour on the way out.
  useEffect(() => {
    setBrowserThemeColor("#000000");
    return () => applyTheme(getThemePref());
  }, []);

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const id = setInterval(
      () => setShift((s) => (s + 1) % SHIFTS.length),
      SHIFT_MS,
    );
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  function reveal() {
    setControls(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControls(false), CONTROLS_MS);
  }

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
  const message = t.error ?? t.notice;
  // Controls are always visible when there is nothing to watch yet, or when
  // something needs attention. Otherwise the screen is only the clock.
  const showPanel = controls || !here || message !== null;

  const wakeNote = !wake.supported
    ? "This browser can't keep the screen awake."
    : wake.held
      ? "Screen stays awake. Recorded timer time."
      : wake.blocked
        ? "The browser refused to keep the screen awake. Turn off Battery Saver."
        : "Asking the browser to keep the screen awake...";

  const digitsClass = [
    "dock__digits",
    t.seconds >= 3600 ? "dock__digits--long" : "",
    !here ? "dock__digits--idle" : t.running ? "" : "dock__digits--paused",
  ]
    .filter(Boolean)
    .join(" ");

  const [dx, dy] = SHIFTS[shift];

  return (
    <main
      className="dock"
      data-theme="dark"
      tabIndex={0}
      onClick={reveal}
      onKeyDown={reveal}
    >
      <div
        className="dock__clock"
        style={{ transform: `translate(${dx}px, ${dy}px)` }}
      >
        <div className={digitsClass} aria-live="off">
          {here ? formatClock(t.seconds) : "0:00"}
        </div>
      </div>

      {showPanel && (
        <div className="dock__panel">
          {elsewhere && session && (
            <div className="dock__msg">
              A timer is running in another room.{" "}
              <Link to={`/rooms/${session.room_id}/dock`}>Open it</Link>
            </div>
          )}
          {message && (
            <div className="dock__msg" role={t.error ? "alert" : "status"}>
              {message}
            </div>
          )}

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
            {document.fullscreenEnabled && !isFs && (
              <button
                type="button"
                className="timer__btn timer__btn--raised"
                onClick={enterFullscreen}
              >
                Fullscreen
              </button>
            )}
            <button
              type="button"
              className="timer__btn timer__btn--raised"
              onClick={exit}
            >
              Exit
            </button>
          </div>

          <div className="dock__note">
            {wakeNote} Tap the screen to show or hide these controls.
          </div>
        </div>
      )}
    </main>
  );
}
