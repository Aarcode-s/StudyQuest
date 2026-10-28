import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { DotText } from "../components/Dots";
import Figure from "../components/Figure";
import Icon from "../components/Icon";
import DurationInput, { clampMinutes } from "../components/DurationInput";
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

function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <div className="row2">
      <div className="rt"><b>{label}</b></div>
      <button type="button" className="rb sm" aria-label={`Less ${label}`} onClick={() => set(value - step)}>−</button>
      <input
        className="field"
        style={{ width: 76, height: 46, padding: 0, textAlign: "center", borderRadius: 23 }}
        inputMode="numeric"
        aria-label={`${label} in minutes`}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
          if (!Number.isNaN(n)) set(n);
        }}
      />
      <button type="button" className="rb sm" aria-label={`More ${label}`} onClick={() => set(value + step)}>+</button>
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();
  const prefs = usePrefs();
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const [goal, setGoal] = useState<GoalKey | null>(null);
  const [pomo, setPomo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [custom, setCustom] = useState(0);
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
          <button className="gr" key={g.key} onClick={() => { setError(null); setCustom(user[g.key]); setGoal(g.key); }}>
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
        <div className="mono muted" style={{ margin: "26px 0 12px" }}>Or set your own</div>
        <DurationInput
          minutes={custom}
          onChange={setCustom}
        />
        <ErrorLine text={error} />
        <div style={{ height: 24 }} />
        <Pill
          onClick={() =>
            active &&
            save({
              [active.key]: clampMinutes(
                custom,
                10,
                active.key === "daily_goal_minutes" ? 1440 : active.key === "weekly_goal_minutes" ? 10080 : 44640,
              ),
            })
          }
        >
          Save
        </Pill>
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
        <div className="card2 list" style={{ marginTop: 20 }}>
          <Stepper label="Focus (min)" value={prefs.focusMin} min={1} max={180} onChange={(v) => setPrefs({ focusMin: v })} />
          <Stepper label="Break (min)" value={prefs.breakMin} min={1} max={60} onChange={(v) => setPrefs({ breakMin: v })} />
          <Stepper label="Long break (min)" value={prefs.longBreakMin} min={1} max={90} onChange={(v) => setPrefs({ longBreakMin: v })} />
          <Stepper label="Rounds before long break" value={prefs.rounds} min={1} max={10} onChange={(v) => setPrefs({ rounds: v })} />
        </div>
        <p className="muted2" style={{ margin: "-4px 6px 0" }}>Changes apply from the next block.</p>
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
