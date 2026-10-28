import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { DotText } from "../components/Dots";
import Figure from "../components/Figure";
import Icon from "../components/Icon";
import { Chip, ErrorLine, Header, Pill, Segmented, Sheet, Toggle } from "../components/ui";
import { formatMinutes } from "../lib/format";
import { setPrefs, usePrefs } from "../lib/prefs";
import { getThemePref, setThemePref } from "../lib/theme";
import type { ThemePref } from "../lib/theme";
import type { ProfilePatch } from "../lib/types";

type GoalKey = "daily_goal_minutes" | "weekly_goal_minutes" | "monthly_goal_minutes";
const GOALS: { key: GoalKey; label: string; options: number[] }[] = [
  { key: "daily_goal_minutes", label: "DAILY GOAL", options: [30, 60, 90, 120, 180, 240] },
  { key: "weekly_goal_minutes", label: "WEEKLY GOAL", options: [300, 600, 900, 1200, 1800] },
  { key: "monthly_goal_minutes", label: "MONTHLY GOAL", options: [1200, 2400, 3600, 4800] },
];
const PRESETS: [number, number, number][] = [
  [25, 5, 15],
  [50, 10, 20],
  [90, 20, 30],
];

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const prefs = usePrefs();
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const [goal, setGoal] = useState<GoalKey | null>(null);
  const [pomo, setPomo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  async function save(patch: ProfilePatch) {
    setError(null);
    try {
      await updateProfile(patch);
      setGoal(null);
    } catch {
      setError("Could not save. Try again.");
    }
  }
  const active = GOALS.find((g) => g.key === goal);

  return (
    <>
      <Header title="Settings" />
      <button className="card2 prof" onClick={() => navigate("/settings/figure")}>
        <div className="pf"><Figure name={user.avatar_key} size={54} color="var(--red)" stroke={3.8} /></div>
        <div>
          <b className="dot" style={{ fontSize: 24 }}>{user.username}</b>
          <div className="mono muted" style={{ marginTop: 6 }}>Change figure ›</div>
        </div>
      </button>

      <div className="card2">
        <div className="mono muted" style={{ marginBottom: 12 }}>Appearance</div>
        <Segmented
          items={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
          value={theme}
          onChange={(v) => {
            setTheme(v);
            setThemePref(v);
          }}
        />
      </div>

      <div className="card2 goals">
        {GOALS.map((g) => (
          <button className="gr" key={g.key} onClick={() => { setError(null); setGoal(g.key); }}>
            <span className="mono muted">{g.label}</span>
            <DotText size={24}>{formatMinutes(user[g.key])}</DotText>
          </button>
        ))}
      </div>

      <button className="card2 link" onClick={() => setPomo(true)}>
        <span>Pomodoro</span>
        <span className="mono muted">{prefs.focusMin} / {prefs.breakMin} ›</span>
      </button>
      <button className="card2 link" onClick={() => navigate("/settings/account")}>
        <span>Account</span>
        <Icon name="chev" size={18} />
      </button>

      <Sheet open={!!active} onClose={() => setGoal(null)}>
        <h2 className="dot">{active?.label.toLowerCase().replace(/^./, (c) => c.toUpperCase())}</h2>
        <div className="chs">
          {active?.options.map((m) => (
            <Chip key={m} on={user[active.key] === m} onClick={() => save({ [active.key]: m })}>
              {formatMinutes(m)}
            </Chip>
          ))}
        </div>
        <ErrorLine text={error} />
      </Sheet>

      <Sheet open={pomo} onClose={() => setPomo(false)}>
        <h2 className="dot">Pomodoro</h2>
        <div className="mono muted" style={{ marginBottom: 12 }}>Focus / break</div>
        <div className="chs">
          {PRESETS.map(([f, b, l]) => (
            <Chip
              key={f}
              on={prefs.focusMin === f && prefs.breakMin === b}
              onClick={() => setPrefs({ focusMin: f, breakMin: b, longBreakMin: l })}
            >
              {f} / {b}
            </Chip>
          ))}
        </div>
        <div className="mono muted" style={{ margin: "24px 0 12px" }}>Rounds before the long break</div>
        <div className="chs">
          {[2, 3, 4, 5, 6].map((n) => (
            <Chip key={n} on={prefs.rounds === n} onClick={() => setPrefs({ rounds: n })}>{n}</Chip>
          ))}
        </div>
        <div className="mono muted" style={{ margin: "24px 0 12px" }}>Long break</div>
        <div className="chs">
          {[15, 20, 30].map((n) => (
            <Chip key={n} on={prefs.longBreakMin === n} onClick={() => setPrefs({ longBreakMin: n })}>{n} min</Chip>
          ))}
        </div>
        <div className="card2 list" style={{ marginTop: 24, marginBottom: 20 }}>
          {([
            ["autoStartBreaks", "Auto-start next block"],
            ["sound", "Sound"],
            ["vibrate", "Vibration"],
          ] as const).map(([k, label]) => (
            <div className="row2" key={k}>
              <div className="rt"><b>{label}</b></div>
              <Toggle on={prefs[k]} label={label} onChange={(v) => setPrefs({ [k]: v })} />
            </div>
          ))}
        </div>
        <Pill onClick={() => setPomo(false)}>Done</Pill>
      </Sheet>
    </>
  );
}
