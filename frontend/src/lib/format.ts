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