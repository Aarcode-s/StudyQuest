let ctx: AudioContext | null = null;

/** A short two-note beep and a buzz, used when a Pomodoro phase changes. */
export function signal(sound: boolean, vibrate: boolean) {
  if (vibrate && "vibrate" in navigator) {
    try {
      navigator.vibrate([180, 90, 180]);
    } catch {
      /* ignore */
    }
  }
  if (!sound) return;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    ctx = ctx ?? new AC();
    const c = ctx;
    void c.resume();
    [660, 880].forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const t = c.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch {
    /* ignore */
  }
}
