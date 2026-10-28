/** 1458 -> "24:18", 3725 -> "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ss = String(sec).padStart(2, "0");
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${ss}`
    : `${String(m).padStart(2, "0")}:${ss}`;
}

/** 4440 -> "1h 14m", 2700 -> "45m", 0 -> "0m" */
export function formatTotal(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m`;
}

/** 120 -> "2h", 90 -> "1h 30m", 45 -> "45m" */
export function formatMinutes(minutes: number): string {
  return formatTotal(minutes * 60);
}

export const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAY_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function monthShort(month: number): string {
  return MONTHS[month - 1];
}

/** "2026-03-18" -> { year, month (1-12), day, weekday (Mon=0 ... Sun=6) } */
export function parseDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return { year, month, day, weekday };
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Hour 0-23 -> "9 AM", "12 PM" */
export function formatHour(h: number): string {
  const suffix = h < 12 ? "AM" : "PM";
  const x = h % 12 === 0 ? 12 : h % 12;
  return `${x} ${suffix}`;
}

export function percent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part * 100) / whole);
}
