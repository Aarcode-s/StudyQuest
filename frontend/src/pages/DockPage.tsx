import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DotText } from "../components/Dots";
import { RoundBtn } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import { useWakeLock } from "../hooks/useWakeLock";
import { formatClock } from "../lib/format";
import { applyTheme, getThemePref, setBrowserThemeColor } from "../lib/theme";
import type { Room } from "../lib/types";
import { useSession } from "../session/useSession";

const CONTROLS_MS = 6000;
const SHIFT_MS = 60_000; // nudge the clock now and then (OLED burn-in)
const SHIFTS = [[0, 0], [8, -6], [-8, 6], [6, 8], [-6, -8]];

export default function DockPage() {
  const navigate = useNavigate();
  const t = useSession();
  useWakeLock(true);
  const rooms = useFetch<Room[]>("/rooms");
  const [controls, setControls] = useState(false);
  const [shift, setShift] = useState(0);
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setBrowserThemeColor("#000000");
    return () => applyTheme(getThemePref());
  }, []);
  useEffect(() => {
    const id = setInterval(() => setShift((s) => (s + 1) % SHIFTS.length), SHIFT_MS);
    return () => clearInterval(id);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Follow the phone turning sideways: size the clock from the free space.
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    try {
      screen.orientation?.unlock?.(); // allow rotation again if something locked it
    } catch {
      /* not supported */
    }
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  function tap() {
    setControls(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setControls(false), CONTROLS_MS);
  }
  async function toggleFs() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* not supported */
    }
  }

  const room = rooms.data?.find((r) => r.id === t.session?.room_id);
  const state = !t.session ? "NO TIMER" : t.onBreak ? "ON BREAK" : t.running ? "FOCUSING" : "PAUSED";
  const [dx, dy] = SHIFTS[shift];
  const text = formatClock(t.seconds);
  // Doto digits are about 0.6 em wide; keep the clock inside the screen.
  const clockSize = Math.max(40, Math.min((vp.w * 0.9) / (text.length * 0.6), vp.h * 0.6, 280));

  return (
    <div className="dockp" onClick={tap}>
      <div className="dk1">
        <i className="live" style={t.running ? undefined : { background: "#3a3a3a", boxShadow: "none" }} />
        <span className="mono">{room ? `${room.name} · ` : ""}{state}</span>
      </div>
      <div className="dkd" style={{ transform: `translate(${dx}px, ${dy}px)` }}>
        <DotText size={clockSize}>{text}</DotText>
      </div>
      {controls ? (
        <div className="dkc" onClick={(e) => e.stopPropagation()}>
          {t.session && !t.onBreak && (
            t.running ? (
              <RoundBtn icon="pause" label="Pause" onClick={() => t.pause("manual")} disabled={t.busy} />
            ) : (
              <RoundBtn icon="play" label="Resume" onClick={() => void t.resume()} disabled={t.busy} />
            )
          )}
          <RoundBtn icon="dock" label="Fullscreen" onClick={toggleFs} />
          <RoundBtn icon="back" label="Exit dock" onClick={() => navigate("/")} />
        </div>
      ) : (
        <div className="dkh mono">Tap for controls</div>
      )}
    </div>
  );
}
