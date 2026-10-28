let ctx: AudioContext | null = null;

export const TONES: { id: string; label: string }[] = [
  { id: "beep", label: "Beep" },
  { id: "chime", label: "Chime" },
  { id: "bell", label: "Bell" },
  { id: "digital", label: "Digital" },
  { id: "soft", label: "Soft" },
  { id: "alarm", label: "Alarm" },
];

type Note = { f: number; at: number; len: number; type?: OscillatorType; vol?: number };

const PATTERNS: Record<string, Note[]> = {
  beep: [
    { f: 660, at: 0, len: 0.2 },
    { f: 880, at: 0.22, len: 0.2 },
  ],
  chime: [
    { f: 784, at: 0, len: 0.9, vol: 0.2 },
    { f: 988, at: 0.18, len: 0.9, vol: 0.2 },
    { f: 1319, at: 0.36, len: 1.2, vol: 0.2 },
  ],
  bell: [
    { f: 523, at: 0, len: 1.6, vol: 0.28 },
    { f: 1046, at: 0, len: 1.2, vol: 0.1 },
    { f: 1568, at: 0, len: 0.8, vol: 0.05 },
  ],
  digital: [0, 0.16, 0.32, 0.6, 0.76, 0.92].map((at) => ({ f: 1500, at, len: 0.08, type: "square" as const, vol: 0.12 })),
  soft: [
    { f: 440, at: 0, len: 0.7, vol: 0.2 },
    { f: 554, at: 0.35, len: 0.9, vol: 0.2 },
  ],
  alarm: [0, 0.3, 0.6, 0.9, 1.2, 1.5].map((at, i) => ({ f: i % 2 ? 740 : 980, at, len: 0.26, type: "sawtooth" as const, vol: 0.14 })),
};

/** Play one alarm tone (also used for the preview in Settings). */
export function playTone(tone: string) {
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    const c = ctx;
    void c.resume();
    for (const n of PATTERNS[tone] ?? PATTERNS.beep) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.frequency.value = n.f;
      osc.type = n.type ?? "sine";
      const t = c.currentTime + n.at;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(n.vol ?? 0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + n.len);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + n.len + 0.05);
    }
  } catch {
    /* ignore */
  }
}

/** Sound and a buzz, used when a Pomodoro phase changes. */
export function signal(sound: boolean, vibrate: boolean, tone = "beep") {
  if (vibrate && "vibrate" in navigator) {
    try {
      navigator.vibrate([180, 90, 180]);
    } catch {
      /* ignore */
    }
  }
  if (sound) playTone(tone);
}
