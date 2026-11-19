import { useState } from "react";
import { DotText } from "../components/Dots";
import Logo from "../components/Logo";
import { drawPom } from "../lib/pom";
import { Header, Pill } from "../components/ui";
import { useFetch } from "../hooks/useFetch";
import {
  WEEKDAY_LETTERS,
  WEEKDAY_SHORT,
  formatTotal,
  monthShort,
  parseDay,
} from "../lib/format";
import type { WeekReview } from "../lib/types";

function rangeText(r: WeekReview): string {
  const a = parseDay(r.week_start);
  const b = parseDay(r.week_end);
  const right = a.month === b.month ? `${b.day}` : `${monthShort(b.month).toUpperCase()} ${b.day}`;
  return `WEEK ${r.iso_week} · ${monthShort(a.month).toUpperCase()} ${a.day}–${right}`;
}

/** Draws the review as a 1080 x 1350 picture for sharing. */
async function drawCard(r: WeekReview, dark: boolean): Promise<Blob | null> {
  try {
    await Promise.all([
      document.fonts.load('900 100px "Fraunces"'),
      document.fonts.load('700 20px "DM Sans"'),
      document.fonts.load('700 20px "DM Sans"'),
    ]);
  } catch {
    /* draw with fallback fonts */
  }
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (!g) return null;
  const bg = dark ? "#1f1610" : "#f4e8cf";
  const text = dark ? "#f4e8cf" : "#3b2a1e";
  const muted = dark ? "#a8926f" : "#6b5443";
  const red = dark ? "#e2772e" : "#b9431b";
  const card = dark ? "#2a1e15" : "#fbf3de";
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = card;
  g.beginPath();
  g.roundRect(60, 60, W - 120, H - 120, 80);
  g.fill();

  g.textBaseline = "alphabetic";
  g.fillStyle = muted;
  g.font = '400 30px "DM Sans", sans-serif';
  g.fillText(rangeText(r), 130, 190);

  g.fillStyle = text;
  g.font = '900 150px "Fraunces", serif';
  g.fillText(formatTotal(r.total_seconds), 130, 370);

  if (r.change_percent !== null) {
    g.fillStyle = r.change_percent >= 0 ? red : muted;
    g.font = '400 34px "DM Sans", sans-serif';
    const arrow = r.change_percent >= 0 ? "▲" : "▼";
    g.fillText(`${arrow} ${Math.abs(r.change_percent)}% VS LAST WEEK`, 130, 440);
  }

  // seven bars
  const max = Math.max(...r.days, 1);
  const bw = 90;
  const gap = (W - 260 - bw * 7) / 6;
  r.days.forEach((v, i) => {
    const h = Math.max(14, (v / max) * 260);
    const x = 130 + i * (bw + gap);
    g.fillStyle = v > 0 ? red : dark ? "#3a2c20" : "#e0cfa8";
    g.beginPath();
    g.roundRect(x, 800 - h, bw, h, 45);
    g.fill();
    g.fillStyle = muted;
    g.font = '400 28px "DM Sans", sans-serif';
    g.textAlign = "center";
    g.fillText(WEEKDAY_LETTERS[i], x + bw / 2, 850);
    g.textAlign = "left";
  });

  const stats: [string, string][] = [
    ["ACTIVE DAYS", `${r.active_days} / 7`],
    ["SESSIONS", String(r.sessions)],
    ["BEST DAY", r.best_day === null ? "—" : WEEKDAY_SHORT[r.best_day]],
  ];
  stats.forEach(([label, value], i) => {
    const x = 130 + i * 280;
    g.fillStyle = muted;
    g.font = '400 24px "DM Sans", sans-serif';
    g.fillText(label, x, 960);
    g.fillStyle = text;
    g.font = '900 60px "Fraunces", serif';
    g.fillText(value, x, 1040);
  });

  // mascot + wordmark
  drawPom(g, 130, 1120, 0.7, dark ? "#f4e8cf" : "#3b2a1e");
  g.fillStyle = muted;
  g.font = '900 44px "Fraunces", serif';
  g.fillText("foco", 220, 1176);
  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

export default function ReviewPage() {
  const { data, error, loading } = useFetch<WeekReview>("/stats/review");
  const [msg, setMsg] = useState<string | null>(null);

  async function share() {
    if (!data) return;
    const dark = document.documentElement.dataset.theme !== "light";
    const blob = await drawCard(data, dark);
    if (!blob) {
      setMsg("Could not create the image.");
      return;
    }
    const file = new File([blob], "foco-week.png", { type: "image/png" });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
    } catch {
      return; // the person closed the share sheet
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "foco-week.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    setMsg("Image saved.");
  }

  const max = Math.max(...(data?.days ?? [1]), 1);
  return (
    <main className="screen noNav">
      <Header title="Review" back="/dashboard" />
      {loading && <p className="mono muted c">Loading…</p>}
      {error && <p className="errline">{error}</p>}
      {data && (
        <>
          <div className="rv">
            <div className="mono muted">{rangeText(data)}</div>
            <div style={{ margin: "14px 0 4px" }}>
              <DotText size={66}>{formatTotal(data.total_seconds)}</DotText>
            </div>
            {data.change_percent !== null && (
              <div className="mono" style={{ color: data.change_percent >= 0 ? "var(--red)" : "var(--muted)" }}>
                {data.change_percent >= 0 ? "▲" : "▼"} {Math.abs(data.change_percent)}% vs last week
              </div>
            )}
            <div className="wk7">
              {data.days.map((v, i) => (
                <div key={i}>
                  <i style={{ height: `${Math.max(6, (v / max) * 76)}px`, opacity: v > 0 ? 1 : 0.25 }} />
                  <span className="mono muted">{WEEKDAY_LETTERS[i]}</span>
                </div>
              ))}
            </div>
            <div className="rvt">
              <div><span className="mono muted">ACTIVE DAYS</span><span className="stat-val">{data.active_days} / 7</span></div>
              <div><span className="mono muted">SESSIONS</span><span className="stat-val">{data.sessions}</span></div>
              <div><span className="mono muted">BEST DAY</span><span className="stat-val">{data.best_day === null ? "—" : WEEKDAY_SHORT[data.best_day]}</span></div>
            </div>
            <div className="rvf"><Logo size={26} fg="var(--text)" /><span style={{ fontFamily: "Fraunces, serif", fontWeight: 700 }}>foco</span></div>
          </div>
          <Pill icon="share" onClick={share}>Share as image</Pill>
          {msg && <p className="okline c">{msg}</p>}
        </>
      )}
    </main>
  );
}
