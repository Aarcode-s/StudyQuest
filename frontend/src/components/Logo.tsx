// Foco's mascot: a fuzzy pom-pom creature with a sprout on top and sleepy happy eyes.
const BUMPS = Array.from({ length: 12 }, (_, i) => {
  const a = (2 * Math.PI * i) / 12;
  return [50 + 25 * Math.cos(a), 58 + 25 * Math.sin(a)] as const;
});

const INK = "#3b2a1e";
const FUR = "#ebb52e";
const BLUSH = "#e2772e";

export default function Logo({
  size = 32,
}: {
  size?: number;
  fg?: string;
  red?: string;
}) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <g style={{ fill: "var(--pom-edge, #3b2a1e)" }}>
        <ellipse cx="40" cy="94" rx="5.5" ry="3.4" />
        <ellipse cx="60" cy="94" rx="5.5" ry="3.4" />
        {BUMPS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={11.4} />
        ))}
        <circle cx="50" cy="58" r="27.4" />
      </g>
      <g fill={FUR}>
        {BUMPS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={8.7} />
        ))}
        <circle cx="50" cy="58" r="25" />
      </g>
      <g fill="none" strokeWidth="3.2" strokeLinecap="round" style={{ stroke: "var(--pom-edge, #3b2a1e)" }}>
        <path d="M50 27 Q50 15 42 13" />
        <path d="M50 27 Q52 14 60 14" />
      </g>
      <g fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round">
        <path d="M34.5 55 Q39 60 43.5 55" />
        <path d="M56.5 55 Q61 60 65.5 55" />
        <path d="M46.5 67 Q50 70.5 53.5 67" />
      </g>
      <circle cx="33" cy="65" r="4.2" fill={BLUSH} opacity="0.6" />
      <circle cx="67" cy="65" r="4.2" fill={BLUSH} opacity="0.6" />
    </svg>
  );
}
