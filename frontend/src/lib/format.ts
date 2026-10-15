/** 1458 -> "24:18", 3725 -> "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(h > 0 ? m : m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 7500 -> "2h 05m", 2700 -> "45m", 0 -> "0m" */
export function formatTotal(totalSeconds: number): string {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const AVATAR_COLORS = [
  "var(--cyan)",
  "var(--pink)",
  "var(--amber)",
  "var(--lavender)",
  "var(--lime)",
];

export function avatarColor(key: string | number): string {
  const s = String(key);
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-03-18" -> { year, month (1-12), day, weekday (Mon=0 ... Sun=6) } */
export function parseDay(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const weekday = (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
  return { year, month, day, weekday };
}

/** "2026-03-18" -> "18 Mar" */
export function formatDayShort(iso: string): string {
  const d = parseDay(iso);
  return `${d.day} ${MONTHS[d.month - 1]}`;
}

/** "2026-03-18" -> "Wed 18 Mar 2026" */
export function formatDayLong(iso: string): string {
  const d = parseDay(iso);
  const wd = WEEKDAYS[(d.weekday + 1) % 7];
  return `${wd} ${d.day} ${MONTHS[d.month - 1]} ${d.year}`;
}

export function monthName(month: number): string {
  return MONTHS[month - 1];
}
