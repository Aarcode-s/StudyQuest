const PTS: [number, number][] = [
  [16, 70],
  [34, 54],
  [50, 60],
  [68, 36],
  [84, 24],
];

/** Logo B: a rising connected line of dots that ends in a red dot. */
export default function Logo({
  size = 32,
  fg = "currentColor",
  red = "var(--red)",
}: {
  size?: number;
  fg?: string;
  red?: string;
}) {
  const d = "M " + PTS.map(([x, y]) => `${x} ${y}`).join(" L ");
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      {[16, 28, 40, 52, 64, 76].map((x) => (
        <circle key={x} cx={x} cy={84} r={2.4} fill={fg} opacity={0.35} />
      ))}
      <path
        d={d}
        fill="none"
        stroke={fg}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {PTS.slice(0, -1).map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r={5.2} fill={fg} />
      ))}
      <circle cx={84} cy={24} r={8} fill={red} />
    </svg>
  );
}
