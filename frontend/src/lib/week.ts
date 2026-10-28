import type { DailyStats } from "./types";
import { parseDay } from "./format";

export type Period = "day" | "week" | "month";

/** Today's entry (the last day of the daily stats, India time). */
export function todayOf(stats: DailyStats) {
  return stats.days[stats.days.length - 1];
}

export function weekDays(stats: DailyStats): (number | null)[] {
  const today = todayOf(stats);
  const wd = parseDay(today.day).weekday;
  const out: (number | null)[] = [];
  for (let i = 0; i < 7; i++) {
    const idx = stats.days.length - 1 - wd + i;
    out.push(i > wd ? null : (stats.days[idx]?.seconds ?? 0));
  }
  return out;
}

export function lastWeekTotal(stats: DailyStats): number {
  const wd = parseDay(todayOf(stats).day).weekday;
  const end = stats.days.length - 1 - wd; // Monday this week
  return stats.days.slice(Math.max(0, end - 7), end).reduce((a, d) => a + d.seconds, 0);
}

export function monthDays(stats: DailyStats): {
  days: (number | null)[];
  today: number;
  count: number;
} {
  const t = parseDay(todayOf(stats).day);
  const count = new Date(Date.UTC(t.year, t.month, 0)).getUTCDate();
  const days: (number | null)[] = [];
  for (let d = 1; d <= count; d++) {
    const idx = stats.days.length - 1 - (t.day - d);
    days.push(d > t.day ? null : (stats.days[idx]?.seconds ?? 0));
  }
  return { days, today: t.day - 1, count };
}

export function lastMonthTotal(stats: DailyStats): number {
  const t = parseDay(todayOf(stats).day);
  const prev = t.month === 1 ? 12 : t.month - 1;
  let sum = 0;
  for (let i = stats.days.length - t.day - 1; i >= 0; i--) {
    if (parseDay(stats.days[i].day).month !== prev) break;
    sum += stats.days[i].seconds;
  }
  return sum;
}
