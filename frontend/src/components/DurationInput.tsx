import { useState } from "react";

const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);

/** Free hours + minutes entry. Calls onChange with the raw total minutes; the caller clamps. */
export const clampMinutes = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export default function DurationInput({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const [h, setH] = useState(String(Math.floor(minutes / 60)));
  const [m, setM] = useState(String(minutes % 60));

  function emit(hs: string, ms: string) {
    onChange((parseInt(hs || "0", 10) || 0) * 60 + (parseInt(ms || "0", 10) || 0));
  }

  const box = { width: 84, height: 54, padding: 0, textAlign: "center" as const, borderRadius: 27 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input
        className="field"
        style={box}
        inputMode="numeric"
        aria-label="Hours"
        value={h}
        onChange={(e) => {
          const v = digits(e.target.value);
          setH(v);
          emit(v, m);
        }}
      />
      <span className="mono muted">h</span>
      <input
        className="field"
        style={box}
        inputMode="numeric"
        aria-label="Minutes"
        value={m}
        onChange={(e) => {
          const v = digits(e.target.value);
          setM(v);
          emit(h, v);
        }}
      />
      <span className="mono muted">min</span>
    </div>
  );
}
