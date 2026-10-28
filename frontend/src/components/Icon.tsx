import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  focus: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor" />
    </>
  ),
  dash: (
    <>
      {[6, 12, 18].flatMap((x) =>
        [6, 12, 18].map((y) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="1.5" fill="currentColor" />
        )),
      )}
    </>
  ),
  rooms: (
    <>
      <circle cx="9" cy="12" r="5.5" />
      <circle cx="15.5" cy="12" r="5.5" />
    </>
  ),
  set: (
    <>
      <path d="M4 8h9M17 8h3M4 16h3M11 16h9" />
      <circle cx="15" cy="8" r="2.2" />
      <circle cx="9" cy="16" r="2.2" />
    </>
  ),
  pause: <path d="M8 5v14M16 5v14" strokeWidth="3.2" />,
  play: <path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="3.2" />,
  dock: <path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />,
  back: <path d="M15 5l-7 7 7 7" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="3.5" />
      <path d="M4 7.5l8 6 8-6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="3" />
      <path d="M15.5 8.5V6.5a2.5 2.5 0 0 0-2.5-2.5H7a2.5 2.5 0 0 0-2.5 2.5V13A2.5 2.5 0 0 0 7 15.5h1.5" />
    </>
  ),
  chev: <path d="M9 5l7 7-7 7" />,
  out: <path d="M9.5 4.5H7A2.5 2.5 0 0 0 4.5 7v10A2.5 2.5 0 0 0 7 19.5h2.5M14 8l4 4-4 4M18 12H9.5" />,
  trash: <path d="M5 7h14M9.5 7V4.5h5V7M7 7l.8 12.5h8.4L17 7" />,
  share: <path d="M12 15V4M8 8l4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9.5" rx="3.2" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  gear: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  skip: <path d="M6 5.5l8 6.5-8 6.5zM18 5v14" />,
};

export type IconName = keyof typeof ICONS;

export default function Icon({
  name,
  size = 22,
  stroke = 2,
}: {
  name: IconName;
  size?: number;
  stroke?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
