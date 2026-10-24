import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { UNIT_LABELS, type Entry, type Unit } from "../lib/api";
import { formatChineseDate, formatFullDate } from "../lib/date";
import {
  formatSignedChange,
  formatWeight,
  movingAverage,
} from "../lib/stats";

const HEIGHT = 248;
const PAD_TOP = 18;
const PAD_RIGHT = 22;
const PAD_BOTTOM = 30;
const PAD_LEFT = 54;

export function TrendChart({ entries, unit }: { entries: Entry[]; unit: Unit }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(720);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const update = () => setWidth(Math.max(320, node.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.date.localeCompare(b.date)),
    [entries],
  );

  const model = useMemo(() => {
    const values = sorted.map((entry) => entry.weight);
    const smooth = movingAverage(values, 7);
    const all = [...values, ...smooth];
    const rawMin = Math.min(...all);
    const rawMax = Math.max(...all);
    const pad = rawMax - rawMin < 0.001 ? 1 : (rawMax - rawMin) * 0.16;
    const min = rawMin - pad;
    const max = rawMax + pad;
    const plotWidth = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
    const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
    const x = (index: number) =>
      sorted.length === 1
        ? PAD_LEFT + plotWidth / 2
        : PAD_LEFT + (index * plotWidth) / (sorted.length - 1);
    const y = (value: number) =>
      PAD_TOP + (1 - (value - min) / (max - min)) * plotHeight;
    const line = sorted
      .map(
        (entry, index) =>
          `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(
            entry.weight,
          ).toFixed(2)}`,
      )
      .join(" ");
    const smoothLine = smooth
      .map(
        (value, index) =>
          `${index === 0 ? "M" : "L"} ${x(index).toFixed(2)} ${y(
            value,
          ).toFixed(2)}`,
      )
      .join(" ");
    const baselineY = (PAD_TOP + plotHeight).toFixed(2);
    const area = `M ${x(0).toFixed(2)} ${baselineY} ${line
      .replace(/^M/, "L")
      .trim()} L ${x(sorted.length - 1).toFixed(2)} ${baselineY} Z`;
    const grid = Array.from({ length: 5 }, (_, index) => {
      const value = max - ((max - min) * index) / 4;
      return { value, y: y(value) };
    });
    const ticks =
      sorted.length <= 6
        ? sorted.map((_, index) => index)
        : Array.from({ length: 5 }, (_, index) =>
            Math.round((index * (sorted.length - 1)) / 4),
          );
    return { x, y, line, smoothLine, area, grid, ticks, plotHeight };
  }, [sorted, width]);

  if (!sorted.length) return null;

  const handleMove = (event: MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const plotWidth = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const index = Math.round(
      ((px - PAD_LEFT) / plotWidth) * (sorted.length - 1),
    );
    setActive(Math.min(sorted.length - 1, Math.max(0, index)));
  };

  const activeEntry = active != null ? sorted[active] : null;
  const activeX = active != null ? model.x(active) : 0;
  const activeY = activeEntry ? model.y(activeEntry.weight) : 0;

  return (
    <div className="trend-chart" ref={containerRef}>
      <svg
        ref={svgRef}
        width={width}
        height={HEIGHT}
        role="img"
        aria-label="体重趋势图"
        onMouseMove={handleMove}
        onMouseLeave={() => setActive(null)}
      >
        {model.grid.map((line) => (
          <g key={line.value}>
            <line
              className="chart-grid-line"
              x1={PAD_LEFT}
              x2={width - PAD_RIGHT}
              y1={line.y}
              y2={line.y}
            />
            <text
              className="chart-y-label"
              x={PAD_LEFT - 9}
              y={line.y + 4}
              textAnchor="end"
            >
              {formatWeight(line.value, unit)}
            </text>
          </g>
        ))}
        <path className="chart-area" d={model.area} />
        <path
          className="chart-line"
          d={model.line}
          vectorEffect="non-scaling-stroke"
        />
        <path
          className="chart-smooth"
          d={model.smoothLine}
          vectorEffect="non-scaling-stroke"
        />
        {model.ticks.map((index) => (
          <text
            key={index}
            className="chart-x-label"
            x={model.x(index)}
            y={HEIGHT - 9}
            textAnchor="middle"
          >
            {formatChineseDate(sorted[index].date)}
          </text>
        ))}
        {sorted.map((entry, index) => (
          <circle
            key={entry.id}
            className={index === sorted.length - 1 ? "chart-dot current" : "chart-dot"}
            cx={model.x(index)}
            cy={model.y(entry.weight)}
            r={index === sorted.length - 1 ? 4 : 2.8}
          />
        ))}
        {active != null ? (
          <g>
            <line
              className="chart-cursor"
              x1={activeX}
              x2={activeX}
              y1={PAD_TOP}
              y2={PAD_TOP + model.plotHeight}
            />
            <circle
              className="chart-cursor-dot"
              cx={activeX}
              cy={activeY}
              r={4.5}
            />
          </g>
        ) : null}
      </svg>
      {activeEntry ? (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(activeX, 130), Math.max(130, width - 130)),
            top: Math.max(8, activeY - 64),
          }}
        >
          <strong>{formatFullDate(activeEntry.date)}</strong>
          <span>
            {formatWeight(activeEntry.weight, unit)} {UNIT_LABELS[unit]}
          </span>
          {active != null && active > 0 ? (
            <em
              className={
                activeEntry.weight - sorted[active - 1].weight < 0
                  ? "change-down"
                  : "change-up"
              }
            >
              {formatSignedChange(
                Number(
                  (
                    activeEntry.weight - sorted[active - 1].weight
                  ).toFixed(2),
                ),
                unit,
              )}
            </em>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
