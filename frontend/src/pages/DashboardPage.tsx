import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  DayDisc,
  HourStrip,
  MonthDisc,
  TrendChart,
  WeekDisc,
} from "../components/Dots";
import { Header, Segmented } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import {
  WEEKDAY_LETTERS,
  WEEKDAY_SHORT,
  formatHour,
  formatMinutes,
  formatTotal,
  parseDay,
  percent,
} from "../lib/format";
import type { DailyStats, Insights } from "../lib/types";
import {
  lastMonthTotal,
  lastWeekTotal,
  monthDays,
  todayOf,
  weekDays,
} from "../lib/week";
import type { Period } from "../lib/week";

type View = "overview" | "insights";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="tile">
      <span className="mono muted">{label}</span>
      <span className="stat-val" style={{ fontSize: 18 }}>{value}</span>
    </div>
  );
}

function change(now: number, before: number): string {
  if (before <= 0) return "—";
  const p = Math.round(((now - before) * 100) / before);
  return `${p >= 0 ? "+" : ""}${p}%`;
}

function Overview({ stats }: { stats: DailyStats }) {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("day");
  const [flipped, setFlipped] = useState(false);
  if (!user) return null;

  const G = user.daily_goal_minutes * 60;
  const today = todayOf(stats).seconds;
  const minActive = stats.streak_min_seconds;
  const wd = parseDay(todayOf(stats).day).weekday;
  const week = weekDays(stats);
  const weekTotal = week.reduce<number>((a, v) => a + (v ?? 0), 0);
  const month = monthDays(stats);
  const monthTotal = month.days.reduce<number>((a, v) => a + (v ?? 0), 0);

  let disc: React.ReactNode;
  let centerPct: number;
  let centerSub: string;
  let tiles: [string, string][];
  let series: (number | null)[];
  let labels: string[];
  let cmpLabel: string;
  let cmpValue: string;
  let bestLabel: (i: number) => string;
  let trendTitle: string;

  if (period === "day") {
    centerPct = percent(today, G);
    centerSub = `${formatTotal(today)} of ${formatMinutes(user.daily_goal_minutes)}`;
    disc = <DayDisc frac={today / G} />;
    tiles = [
      ["TODAY", formatTotal(today)],
      ["GOAL", formatMinutes(user.daily_goal_minutes)],
      ["LEFT", formatTotal(Math.max(0, G - today))],
    ];
    const last7 = stats.days.slice(-7);
    series = last7.map((d) => d.seconds);
    labels = last7.map((d) => WEEKDAY_LETTERS[parseDay(d.day).weekday]);
    const dayNames = last7.map((d) => WEEKDAY_SHORT[parseDay(d.day).weekday]);
    bestLabel = (i) => dayNames[i];
    cmpLabel = "VS YESTERDAY";
    cmpValue = change(today, stats.days[stats.days.length - 2]?.seconds ?? 0);
    trendTitle = "DAILY FOCUS · LAST 7 DAYS";
  } else if (period === "week") {
    const W = user.weekly_goal_minutes * 60;
    centerPct = percent(weekTotal, W);
    centerSub = `${formatTotal(weekTotal)} of ${formatMinutes(user.weekly_goal_minutes)}`;
    disc = <WeekDisc values={week.map((v) => (v === null ? null : v / G))} />;
    const active = week.filter((v) => v !== null && v >= minActive).length;
    tiles = [
      ["THIS WEEK", formatTotal(weekTotal)],
      ["ACTIVE", `${active} / ${wd + 1}`],
      ["BEST", formatTotal(Math.max(0, ...week.map((v) => v ?? 0)))],
    ];
    series = week;
    labels = WEEKDAY_LETTERS;
    bestLabel = (i) => WEEKDAY_SHORT[i];
    cmpLabel = "VS LAST WEEK";
    cmpValue = change(weekTotal, lastWeekTotal(stats));
    trendTitle = "DAILY FOCUS · THIS WEEK";
  } else {
    const M = user.monthly_goal_minutes * 60;
    const elapsed = month.today + 1;
    centerPct = percent(monthTotal, M);
    centerSub = `of ${formatMinutes(user.monthly_goal_minutes)}`;
    disc = <MonthDisc values={month.days.map((v) => (v === null ? null : v / G))} today={month.today} />;
    const active = month.days.filter((v) => v !== null && v >= minActive).length;
    tiles = [
      ["MONTH", formatTotal(monthTotal)],
      ["ACTIVE", `${active} / ${elapsed}`],
      ["PER DAY", formatTotal(monthTotal / elapsed)],
    ];
    series = month.days;
    labels = month.days.map((_, i) => String(i + 1));
    bestLabel = (i) => `#${i + 1}`;
    cmpLabel = "VS LAST MONTH";
    cmpValue = change(monthTotal, lastMonthTotal(stats));
    trendTitle = "DAILY FOCUS · THIS MONTH";
  }

  const real = series
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null);
  // Best / lowest only mean something once there are a few active days.
  const activeReal = real.filter((p) => p.v >= minActive);
  const enough = activeReal.length >= 3;
  const best = enough ? activeReal.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const low = enough ? activeReal.reduce((a, b) => (b.v < a.v ? b : a)) : null;

  return (
    <>
      <Segmented
        items={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ]}
        value={period}
        onChange={(p) => {
          setPeriod(p);
          setFlipped(false);
        }}
      />
      {!flipped ? (
        <>
          <button className="discw" onClick={() => setFlipped(true)} aria-label="Show the trend">
            {disc}
            <div className="dcen">
              <span className="stat-val" style={{ fontSize: period === "month" ? 34 : 46 }}>{`${centerPct}%`}</span>
              <div className="mono muted" style={{ fontSize: 10 }}>{centerSub}</div>
            </div>
          </button>
          <div className="mono muted c" style={{ marginTop: 6 }}>Tap the circle for trend</div>
          <div className="tiles">
            {tiles.map(([a, b]) => (
              <Tile key={a} label={a} value={b} />
            ))}
          </div>
          {period === "week" && (
            <Link to="/review" className="pill ghost" style={{ marginTop: 22, textDecoration: "none" }}>
              Weekly review
            </Link>
          )}
        </>
      ) : (
        <>
          <button className="gcard" style={{ width: "100%", textAlign: "left" }} onClick={() => setFlipped(false)} aria-label="Back to the circle">
            <div className="mono muted">{trendTitle}</div>
            <TrendChart
              values={series}
              goal={G}
              labels={labels}
              goalLabel={`GOAL ${formatMinutes(user.daily_goal_minutes).toUpperCase()}`}
            />
          </button>
          <div className="tiles">
            <Tile label={cmpLabel} value={cmpValue} />
            <Tile label="BEST DAY" value={best ? bestLabel(best.i) : "—"} />
            <Tile label="LOWEST" value={low && low.i !== best?.i ? bestLabel(low.i) : "—"} />
          </div>
          {!enough && <p className="mono muted c" style={{ marginTop: 14, fontSize: 9.5 }}>Best and lowest day appear after 3 active days</p>}
          <div className="mono muted c" style={{ marginTop: 14 }}>Tap the chart to go back</div>
        </>
      )}
    </>
  );
}

function getPersona(peakHours: number[]) {
  if (peakHours.length !== 2) {
    return {
      icon: "⏱",
      title: "Discovering Rhythm",
      sub: "Focus 3+ days to reveal your study persona",
    };
  }
  const start = peakHours[0];
  if (start >= 5 && start < 12) {
    return {
      icon: "🌅",
      title: "Early Bird",
      sub: "Your mind hits peak flow in the morning",
    };
  }
  if (start >= 12 && start < 17) {
    return {
      icon: "☀️",
      title: "Midday Achiever",
      sub: "You build strong momentum through the afternoon",
    };
  }
  if (start >= 17 && start < 22) {
    return {
      icon: "🌆",
      title: "Evening Builder",
      sub: "You focus deeply as the day winds down",
    };
  }
  return {
    icon: "🌙",
    title: "Night Owl",
    sub: "You thrive during quiet late night hours",
  };
}

function InsightsView({ activeDays }: { activeDays: number }) {
  const { data, error, loading } = useFetch<Insights>("/stats/insights");
  if (loading) return <p className="mono muted c" style={{ marginTop: 40 }}>Loading…</p>;
  if (error || !data) return <p className="errline">{error ?? "Could not load."}</p>;
  const enough = activeDays >= 3 && data.sessions >= 3;
  if (data.sessions === 0) {
    return (
      <div className="gcard c">
        <p className="mono muted">Finish a focus session to see your insights</p>
      </div>
    );
  }
  const persona = getPersona(enough ? data.peak_hours : []);
  const peakRange =
    enough && data.peak_hours.length === 2
      ? `${formatHour(data.peak_hours[0])} – ${formatHour((data.peak_hours[1] + 1) % 24)}`
      : null;
  const you = data.breaks_per_hour;
  const room = data.room.breaks_per_hour;
  const maxB = Math.max(you ?? 0, room ?? 0, 0.1);
  return (
    <>
      <div className="gcard">
        <div className="mono muted" style={{ fontSize: 10 }}>WHEN YOU STUDY BEST</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "10px 0 16px" }}>
          <span style={{ fontSize: 32 }} role="img" aria-label={persona.title}>{persona.icon}</span>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{persona.title}</div>
            <div className="muted2" style={{ fontSize: 12.5 }}>
              {peakRange ? `Peak Focus: ${peakRange}` : persona.sub}
            </div>
          </div>
        </div>
        <HourStrip hours={data.hours} peak={enough ? data.peak_hours : []} />
        {!enough && <p className="mono muted" style={{ marginTop: 14, fontSize: 10 }}>Personalized insights appear after 3 active days</p>}
      </div>

      <div className="tiles2">
        <div className="tile">
          <span className="mono muted">AVG SESSION</span>
          <span className="stat-val">{formatTotal(data.avg_session_seconds)}</span>
        </div>
        <div className="tile">
          <span className="mono muted">LONGEST</span>
          <span className="stat-val">{formatTotal(data.longest_session_seconds)}</span>
        </div>
      </div>

      <div className="gcard">
        <div className="mono muted" style={{ marginBottom: 14, fontSize: 10 }}>FOCUS QUALITY & FLOW</div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div style={{ background: "var(--card2)", borderRadius: "var(--radius-md)", padding: "12px 14px", border: "1px solid var(--line)" }}>
            <span className="mono muted" style={{ fontSize: 9.5 }}>AVG RATING</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 4 }}>
              <span style={{ color: "var(--red)", fontSize: 15 }}>★</span>
              <span className="stat-val" style={{ fontSize: 20 }}>
                {data.avg_rating !== null ? `${data.avg_rating}` : "—"}
              </span>
              <span className="muted2" style={{ fontSize: 12 }}>/ 5</span>
            </div>
          </div>
          
          <div style={{ background: "var(--card2)", borderRadius: "var(--radius-md)", padding: "12px 14px", border: "1px solid var(--line)" }}>
            <span className="mono muted" style={{ fontSize: 9.5 }}>FOCUS : BREAK</span>
            <div style={{ marginTop: 4 }}>
              <span className="stat-val" style={{ fontSize: 20 }}>
                {data.focus_break_ratio !== null ? `${data.focus_break_ratio}:1` : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="mono muted" style={{ margin: "14px 0 8px", fontSize: 10 }}>BREAKS PER HOUR</div>
        <div className="cmp" style={{ marginTop: 8 }}>
          <div>
            <span className="mono">YOU</span>
            <div className="bar"><u style={{ width: `${((you ?? 0) / maxB) * 100}%` }} /></div>
            <b className="stat-val" style={{ fontSize: 15 }}>{you !== null ? `${you}/h` : "—"}</b>
          </div>
          <div>
            <span className="mono muted">ROOM</span>
            <div className="bar g"><u style={{ width: `${((room ?? 0) / maxB) * 100}%` }} /></div>
            <b className="stat-val muted" style={{ fontSize: 15 }}>{room !== null ? `${room}/h` : "—"}</b>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <span className="ch" style={{ cursor: "default", fontSize: 11.5, padding: "6px 12px" }}>
            Left app {data.left_app_count}×
          </span>
          {enough && data.best_weekday !== null && (
            <span className="ch" style={{ cursor: "default", fontSize: 11.5, padding: "6px 12px" }}>
              Best day: {WEEKDAY_SHORT[data.best_weekday]}
            </span>
          )}
          {you !== null && room !== null && room > 0 && you < room && (
            <span className="ch" style={{ cursor: "default", fontSize: 11.5, padding: "6px 12px", borderColor: "var(--red)", color: "var(--red)" }}>
              ⚡ {Math.round(((room - you) / room) * 100)}% fewer breaks than room
            </span>
          )}
        </div>
        {room === null && (
          <p className="mono muted" style={{ marginTop: 14, fontSize: 10 }}>
            Room average appears when 2+ other members share their stats
          </p>
        )}
      </div>
    </>
  );
}

export default function DashboardPage() {
  const [view, setView] = useState<View>("overview");
  const stats = useFetch<DailyStats>("/stats/daily?days=70", 60_000);
  return (
    <>
      <Header
        title="Dashboard"
        right={
          <Segmented
            tiny
            items={[
              { value: "overview", label: "Overview" },
              { value: "insights", label: "Insights" },
            ]}
            value={view}
            onChange={setView}
          />
        }
      />
      {view === "insights" ? (
        <InsightsView activeDays={stats.data ? stats.data.days.filter((d) => d.seconds >= stats.data!.streak_min_seconds).length : 0} />
      ) : stats.data ? (
        <Overview stats={stats.data} />
      ) : stats.error ? (
        <p className="errline">{stats.error}</p>
      ) : (
        <p className="mono muted c" style={{ marginTop: 40 }}>Loading…</p>
      )}
    </>
  );
}
