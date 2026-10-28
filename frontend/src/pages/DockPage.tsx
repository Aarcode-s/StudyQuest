import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DotText } from "../components/Dots";
import { RoundBtn } from "../components/ui";
import { useWakeLock } from "../hooks/useWakeLock";
import { formatClock } from "../lib/format";
import { enterDock, exitDock } from "../lib/dock";
import { applyTheme, getThemePref, setBrowserThemeColor } from "../lib/theme";
import { useSession } from "../session/useSession";

const CONTROLS_MS = 6000;
const SHIFT_MS = 60_000; // nudge the clock now and then (OLED burn-in)
const SHIFTS = [[0, 0], [8, -6], [-8, 6], [6, 8], [-6, -8]];

export default function DockPage() {
  const navigate = useNavigate();
  const t = useSession();
  useWakeLock(true);
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
    void enterDock(); // works when the tap that opened the dock is still fresh
    const onFs = () => {
      if (!document.fullscreenElement) {
        try {
          screen.orientation?.unlock?.();
        } catch {
          /* ignore */
        }
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      document.removeEventListener("fullscreenchange", onFs);
      void exitDock();
    };
  }, []);

  function tap() {
    setControls(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setControls(false), CONTROLS_MS);
  }
  async function toggleFs() {
    if (document.fullscreenElement) await exitDock();
    else await enterDock();
  }

  const [dx, dy] = SHIFTS[shift];
  const text = formatClock(t.seconds);
  // Doto digits are about 0.6 em wide; keep the clock inside the screen.
  const clockSize = Math.max(40, Math.min((vp.w * 0.9) / (text.length * 0.6), vp.h * 0.6, 280));

  return (
    <div className="dockp" onClick={tap}>
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
      ) : null}
    </div>
  );
}
