import { useEffect, useRef, useState } from "react";
import { formatDayLong, formatTotal, monthName, parseDay } from "../lib/format";
import type { DayTotal } from "../lib/types";
import "./StreakGrid.css";

const ROW_LABELS = ["Mon", "", "Wed", "", "Fri", "", ""];

/** 0 = nothing, 1 = some time but below the streak minimum, 2-4 = more and more. */
function level(seconds: number, minSeconds: number): number {
  if (seconds <= 0) return 0;
  if (seconds < minSeconds) return 1;
  if (seconds < 3600) return 2;
  if (seconds < 7200) return 3;
  return 4;
}

export default function StreakGrid({
  days,
  minSeconds,
}: {
  days: DayTotal[];
  minSeconds: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<number | null>(null);

  // Start scrolled to the newest week.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [days.length]);

  if (days.length === 0) return null;

  // Pad the front so the first day lands on its weekday row (Monday = row 0).
  const lead = parseDay(days[0].day).weekday;
  const cells: (DayTotal | null)[] = [
    ...Array<null>(lead).fill(null),
    ...days,
  ];
  const columns = Math.ceil(cells.length / 7);

  // A month label goes above the week that contains the 1st of that month.
  const monthLabels: string[] = [];
  for (let c = 0; c < columns; c++) {
    let label = "";
    for (let r = 0; r < 7; r++) {
      const cell = cells[c * 7 + r];
      if (cell && cell.day.endsWith("-01")) {
        label = monthName(parseDay(cell.day).month);
        break;
      }
    }
    monthLabels.push(label);
  }

  function onGridClick(e: React.MouseEvent<HTMLDivElement>) {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-i]");
    if (!target) return;
    const i = Number(target.dataset.i);
    setPicked((p) => (p === i ? null : i));
  }

  const pickedCell = picked !== null ? cells[picked] : null;
  const lastIndex = cells.length - 1;

  return (
    <div className="streak">
      <div className="streak__frame">
        <div className="streak__rows" aria-hidden="true">
          {ROW_LABELS.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
        <div className="streak__scroller" ref={scroller}>
          <div className="streak__months" aria-hidden="true">
            {monthLabels.map((l, i) => (
              <span key={i}>{l}</span>
            ))}
          </div>
          <div
            className="streak__grid"
            role="img"
            aria-label="Focus time for each of the last 12 months. Tap a square for details."
            onClick={onGridClick}
          >
            {cells.map((cell, i) =>
              cell === null ? (
                <span key={`pad-${i}`} className="streak__pad" />
              ) : (
                <span
                  key={cell.day}
                  data-i={i}
                  className={`streak__cell streak__cell--${level(cell.seconds, minSeconds)} ${
                    i === lastIndex ? "streak__cell--today" : ""
                  } ${i === picked ? "streak__cell--picked" : ""}`}
                  title={`${formatDayLong(cell.day)}: ${
                    cell.seconds > 0 ? formatTotal(cell.seconds) : "no focus time"
                  }`}
                />
              ),
            )}
          </div>
        </div>
      </div>

      <div className="streak__caption" role="status">
        {pickedCell
          ? `${formatDayLong(pickedCell.day)}: ${
              pickedCell.seconds > 0
                ? formatTotal(pickedCell.seconds)
                : "no focus time"
            }`
          : "Tap a square to see that day."}
      </div>

      <div className="streak__legend" aria-hidden="true">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`streak__cell streak__cell--${l}`} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
