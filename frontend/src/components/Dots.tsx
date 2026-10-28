import { Fragment, useMemo } from "react";
import type { ReactNode } from "react";

const PI = Math.PI;

// ---------------------------------------------------------------- % sign
// Doto draws "%" so that it looks like an X, so the app draws its own
// dot-matrix percent sign from a 5 x 7 grid and uses it everywhere a Doto
// number is followed by a percent.
const PCT_ROWS = [
  "11001",
  "11010",
  "00010",
  "00100",
  "01000",
  "01011",
  "10011",
];

export function Pct({ size }: { size: number }) {
  const h = size * 0.7; // Doto capital height is about 0.7 em
  const w = (h * 5) / 7;
  return (
    <svg
      viewBox="0 0 5 7"
      width={w}
      height={h}
      fill="currentColor"
      aria-label="percent"
      style={{ display: "inline-block", marginLeft: size * 0.06, verticalAlign: "baseline" }}
    >
      {PCT_ROWS.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === "1" ? <circle key={`${x}-${y}`} cx={x + 0.5} cy={y + 0.5} r={0.42} /> : null,
        ),
      )}
    </svg>
  );
}

/** Doto draws ":" with a cross in the middle, so the clock draws its own. */
function Colon({ size }: { size: number }) {
  const d = size * 0.12;
  const dot = (top: string) => (
    <i
      style={{
        position: "absolute",
        left: 0,
        top,
        width: d,
        height: d,
        borderRadius: "50%",
        background: "currentColor",
      }}
    />
  );
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-block",
        position: "relative",
        width: d,
        height: size * 0.7,
        margin: `0 ${size * 0.1}px`,
      }}
    >
      {dot("24%")}
      {dot("62%")}
    </span>
  );
}

/** Doto text where every "%" is drawn with the dot-matrix percent sign. */
export function DotText({
  children,
  size,
  className = "",
}: {
  children: string;
  size: number;
  className?: string;
}) {
  const parts = children.split(/([%:])/);
  return (
    <span className={`dot ${className}`} style={{ fontSize: size, lineHeight: 1 }}>
      {parts.map((p, i) =>
        p === "%" ? (
          <Pct key={i} size={size} />
        ) : p === ":" ? (
          <Colon key={i} size={size} />
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </span>
  );
}

// ---------------------------------------------------------------- dot field
function DotField() {
  const dots = useMemo(() => {
    const out: ReactNode[] = [];
    const rmax = 146;
    for (let r = 14; r <= rmax; r += 14) {
      const n = Math.max(6, Math.floor((2 * PI * r) / 9.5));
      for (let i = 0; i < n; i++) {
        const a = (2 * PI * i) / n;
        out.push(
          <circle
            key={`${r}-${i}`}
            cx={150 + r * Math.cos(a)}
            cy={150 + r * Math.sin(a)}
            r={1.25}
            fill="var(--dot-off)"
            opacity={0.9 * (1 - r / (rmax * 1.35))}
          />,
        );
      }
    }
    return out;
  }, []);
  return <>{dots}</>;
}

function pos(i: number, n: number, r: number): [number, number] {
  const a = -PI / 2 + (2 * PI * i) / n;
  return [150 + r * Math.cos(a), 150 + r * Math.sin(a)];
}

// ---------------------------------------------------------------- big ring clock
export function RingClock({ frac }: { frac: number }) {
  const lit = Math.round(72 * Math.min(1, Math.max(0, frac)));
  return (
    <svg viewBox="0 0 300 300" className="ringsvg" aria-hidden="true">
      {Array.from({ length: 72 }, (_, i) => {
        const [x, y] = pos(i, 72, 138);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i < lit ? 3.7 : 2.5}
            fill={i < lit ? "var(--red)" : "var(--dot-off)"}
          />
        );
      })}
    </svg>
  );
}

export function Arc({ frac, size = 108 }: { frac: number; size?: number }) {
  const r = 44;
  const L = 2 * PI * r;
  const f = Math.min(1, Math.max(0, frac));
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--dot-off)" strokeWidth="4" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="var(--red)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${L * f} ${L}`}
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}

// ---------------------------------------------------------------- dashboard discs
export function DayDisc({ frac }: { frac: number }) {
  const n = 60;
  const lit = Math.round(n * Math.min(1, Math.max(0, frac)));
  return (
    <svg viewBox="0 0 300 300" className="discsvg" aria-hidden="true">
      <DotField />
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = pos(i, n, 84);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i < lit ? 4 : 2.6}
            fill={i < lit ? "var(--red)" : "var(--dot-off2)"}
          />
        );
      })}
    </svg>
  );
}

/** values: fraction of the daily goal for each day, null = not yet. */
export function WeekDisc({ values }: { values: (number | null)[] }) {
  return (
    <svg viewBox="0 0 300 300" className="discsvg" aria-hidden="true">
      <DotField />
      {values.map((v, i) => {
        const [x, y] = pos(i, 7, 84);
        const [lx, ly] = pos(i, 7, 122);
        return (
          <g key={i}>
            {v === null ? (
              <circle cx={x} cy={y} r={8} fill="none" stroke="var(--dot-off2)" strokeWidth={1.5} strokeDasharray="2 3" />
            ) : v <= 0 ? (
              <circle cx={x} cy={y} r={8} fill="none" stroke="var(--dot-off2)" strokeWidth={2} />
            ) : (
              <circle cx={x} cy={y} r={5 + 5 * Math.min(v, 1)} fill="var(--red)" opacity={0.35 + 0.65 * Math.min(v, 1)} />
            )}
            <text x={lx} y={ly + 3} textAnchor="middle" fontFamily="Space Mono, monospace" fontSize="10" fill="var(--muted)">
              {"MTWTFSS"[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function MonthDisc({
  values,
  today,
}: {
  values: (number | null)[];
  today: number;
}) {
  const n = values.length;
  return (
    <svg viewBox="0 0 300 300" className="discsvg" aria-hidden="true">
      <DotField />
      {values.map((v, i) => {
        const [x, y] = pos(i, n, 84);
        const k = Math.min(1, v ?? 0);
        return (
          <g key={i}>
            {v === null ? (
              <circle cx={x} cy={y} r={2.2} fill="var(--dot-off2)" opacity={0.6} />
            ) : v <= 0 ? (
              <circle cx={x} cy={y} r={3.2} fill="var(--dot-off2)" />
            ) : (
              <circle cx={x} cy={y} r={3.6 + 3 * k} fill="var(--red)" opacity={0.3 + 0.7 * k} />
            )}
            {i === today && (
              <circle cx={x} cy={y} r={10.5} fill="none" stroke="var(--text)" strokeWidth={1.6} />
            )}
          </g>
        );
      })}
      <text x="150" y="40" textAnchor="middle" fontFamily="Space Mono, monospace" fontSize="9.5" fill="var(--muted)">1</text>
    </svg>
  );
}

// ---------------------------------------------------------------- trend chart
export function TrendChart({
  values,
  goal,
  labels,
  goalLabel,
}: {
  values: (number | null)[];
  goal: number;
  labels: string[];
  goalLabel: string;
}) {
  const W = 318;
  const H = 210;
  const px = 14;
  const py = 16;
  const n = values.length;
  const nums = values.filter((v): v is number => v !== null);
  const mx = Math.max(goal, ...nums, 1) * 1.1;
  const X = (i: number) => px + (n === 1 ? 0 : (i * (W - 2 * px)) / (n - 1));
  const Y = (v: number) => H - 26 - (v / mx) * (H - 26 - py);
  const real = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v !== null);
  const hi = real.length ? real.reduce((a, b) => (b.v > a.v ? b : a)).i : -1;
  const lo = real.length > 1 ? real.reduce((a, b) => (b.v < a.v ? b : a)).i : -1;
  const gy = Y(goal);
  const step = n > 12 ? Math.ceil(n / 6) : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trendsvg" aria-hidden="true">
      {Array.from({ length: 21 }, (_, i) =>
        Array.from({ length: 7 }, (_, j) => (
          <circle key={`${i}-${j}`} cx={px + (i * (W - 2 * px)) / 20} cy={py + (j * (H - 26 - py)) / 6} r={1.1} fill="var(--dot-off)" />
        )),
      )}
      <line x1={px} x2={W - px} y1={gy} y2={gy} stroke="var(--red)" strokeWidth={1.5} strokeDasharray="3 5" />
      <text x={W - px} y={gy - 7} textAnchor="end" fontFamily="Space Mono, monospace" fontSize="9.5" fill="var(--red)">
        {goalLabel}
      </text>
      <polyline
        points={real.map((p) => `${X(p.i)},${Y(p.v)}`).join(" ")}
        fill="none"
        stroke="var(--text)"
        strokeWidth={2.2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {real.map((p) => (
        <circle
          key={p.i}
          cx={X(p.i)}
          cy={Y(p.v)}
          r={p.i === hi || p.i === lo ? 5.2 : n > 12 ? 2.2 : 3.4}
          fill={p.i === hi ? "var(--red)" : "var(--bg)"}
          stroke={p.i === hi ? "var(--red)" : "var(--text)"}
          strokeWidth={2}
        />
      ))}
      {labels.map((l, i) =>
        i % step === 0 ? (
          <text key={i} x={X(i)} y={H - 6} textAnchor="middle" fontFamily="Space Mono, monospace" fontSize="9.5" fill="var(--muted)">
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

// ---------------------------------------------------------------- hours strip
export function HourStrip({ hours, peak }: { hours: number[]; peak: number[] }) {
  const max = Math.max(...hours, 1);
  return (
    <>
      <div className="hs">
        {hours.map((v, h) => {
          const level = v <= 0 ? 0 : Math.max(1, Math.round((v / max) * 6));
          return (
            <div className="hc" key={h}>
              {Array.from({ length: 6 }, (_, r) => (
                <i key={r} className={`${5 - r < level ? "on" : ""} ${peak.includes(h) ? "pk" : ""}`} />
              ))}
            </div>
          );
        })}
      </div>
      <div className="hl mono muted">
        <span>12A</span>
        <span>6A</span>
        <span>12P</span>
        <span>6P</span>
      </div>
    </>
  );
}
