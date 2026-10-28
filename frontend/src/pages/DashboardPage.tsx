import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import {
  DayDisc,
  DotText,
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
      <DotText size={19}>{value}</DotText>
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
  const best = real.length ? real.reduce((a, b) => (b.v > a.v ? b : a)) : null;
  const low = real.length > 1 ? real.reduce((a, b) => (b.v < a.v ? b : a)) : null;

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
              <DotText size={period === "month" ? 38 : 54}>{`${centerPct}%`}</DotText>
              <div className="mono muted" style={{ fontSize: 9.5 }}>{centerSub}</div>
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
            <Tile label="BEST DAY" value={best && best.v > 0 ? bestLabel(best.i) : "—"} />
            <Tile label="LOWEST" value={low ? bestLabel(low.i) : "—"} />
          </div>
          <div className="mono muted c" style={{ marginTop: 14 }}>Tap the chart to go back</div>
        </>
      )}
    </>
  );
}

function InsightsView() {
  const { data, error, loading } = useFetch<Insights>("/stats/insights");
  if (loading) return <p className="mono muted c" style={{ marginTop: 40 }}>Loading…</p>;
  if (error || !data) return <p className="errline">{error ?? "Could not load."}</p>;
  if (data.sessions === 0) {
    return (
      <div className="gcard c">
        <p className="mono muted">Finish a focus session to see your insights</p>
      </div>
    );
  }
  const peak =
    data.peak_hours.length === 2
      ? `${formatHour(data.peak_hours[0])} – ${formatHour((data.peak_hours[1] + 1) % 24)}`
      : "—";
  const you = data.breaks_per_hour;
  const room = data.room.breaks_per_hour;
  const maxB = Math.max(you ?? 0, room ?? 0, 0.1);
  return (
    <>
      <div className="gcard">
        <div className="mono muted">When you study best</div>
        <div className="dot" style={{ fontSize: 26, margin: "8px 0 18px" }}>{peak}</div>
        <HourStrip hours={data.hours} peak={data.peak_hours} />
      </div>
      <div className="tiles2">
        <div className="tile"><span className="mono muted">AVG SESSION</span><span className="dot">{formatTotal(data.avg_session_seconds)}</span></div>
        <div className="tile"><span className="mono muted">LONGEST</span><span className="dot">{formatTotal(data.longest_session_seconds)}</span></div>
      </div>
      <div className="gcard">
        <div className="mono muted">Breaks per hour</div>
        <div className="cmp">
          <div>
            <span className="mono">YOU</span>
            <div className="bar"><u style={{ width: `${((you ?? 0) / maxB) * 100}%` }} /></div>
            <b className="dot">{you ?? "—"}</b>
          </div>
          <div>
            <span className="mono muted">ROOM</span>
            <div className="bar g"><u style={{ width: `${((room ?? 0) / maxB) * 100}%` }} /></div>
            <b className="dot muted">{room ?? "—"}</b>
          </div>
        </div>
        {room === null && (
          <p className="mono muted" style={{ marginTop: 16, fontSize: 9.5 }}>
            Room average appears when 2+ other members share their stats
          </p>
        )}
      </div>
      <div className="tiles2">
        <div className="tile"><span className="mono muted">LEFT THE APP</span><span className="dot">{data.left_app_count}×</span></div>
        <div className="tile"><span className="mono muted">BEST DAY</span><span className="dot">{data.best_weekday === null ? "—" : WEEKDAY_SHORT[data.best_weekday]}</span></div>
        <div className="tile"><span className="mono muted">FOCUS : BREAK</span><span className="dot">{data.focus_break_ratio === null ? "—" : `${data.focus_break_ratio}:1`}</span></div>
        <div className="tile"><span className="mono muted">AVG FOCUS</span><span className="dot">{data.avg_rating === null ? "—" : `${data.avg_rating}/5`}</span></div>
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
        <InsightsView />
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
