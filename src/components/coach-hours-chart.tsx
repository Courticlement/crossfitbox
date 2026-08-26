"use client";

import { useMemo, useState } from "react";

export type CoachHoursSeries = {
  id: string;
  name: string;
  color: string;
  hours: number[]; // length 12, index 0 = January
};

const PAD_LEFT = 40;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 28;
const WIDTH = 880;
const HEIGHT = 320;
const INNER_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

// Rounds up to a "clean" axis max (…1/2/5 × 10^n) so gridline ticks read as
// round numbers instead of an arbitrary max * 1.1.
function niceCeil(value: number): number {
  if (value <= 0) return 5;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const residual = value / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return niceResidual * magnitude;
}

function xForMonth(monthIndex: number): number {
  return PAD_LEFT + (monthIndex / 11) * INNER_WIDTH;
}

function yForValue(value: number, yMax: number): number {
  return PAD_TOP + INNER_HEIGHT - (value / yMax) * INNER_HEIGHT;
}

export function CoachHoursChart({
  monthLabels,
  series,
}: {
  monthLabels: string[]; // length 12
  series: CoachHoursSeries[];
}) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const visibleSeries = series.filter((s) => !hiddenIds.has(s.id));

  const yMax = useMemo(() => {
    const max = Math.max(0, ...visibleSeries.flatMap((s) => s.hours));
    return niceCeil(max * 1.1 || 1);
  }, [visibleSeries]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(yMax * f * 10) / 10);

  function toggleCoach(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, relX / rect.width));
    setHoverMonth(Math.round(ratio * 11));
  }

  if (series.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 text-center text-sm text-neutral-500">
        Aucun coach pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {series.map((s) => {
          const hidden = hiddenIds.has(s.id);
          return (
            <label
              key={s.id}
              className="flex cursor-pointer items-center gap-1.5 text-xs select-none"
            >
              <input
                type="checkbox"
                checked={!hidden}
                onChange={() => toggleCoach(s.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-sm border"
                style={{
                  backgroundColor: hidden ? "transparent" : s.color,
                  borderColor: s.color,
                }}
              />
              <span className={hidden ? "text-neutral-600 line-through" : "text-neutral-300"}>
                {s.name}
              </span>
            </label>
          );
        })}
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="ml-auto rounded px-2 py-1 text-xs text-neutral-400 hover:text-white"
        >
          {showTable ? "Voir le graphique" : "Voir en tableau"}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-400">
              <tr>
                <th className="px-2 py-1 font-medium">Coach</th>
                {monthLabels.map((label) => (
                  <th key={label} className="px-2 py-1 text-right font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((s) => (
                <tr key={s.id} className="border-t border-neutral-800">
                  <td className="px-2 py-1 text-white">
                    <span
                      aria-hidden
                      className="mr-1.5 inline-block h-2 w-2 rounded-sm align-middle"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.name}
                  </td>
                  {s.hours.map((h, i) => (
                    <td key={i} className="px-2 py-1 text-right text-neutral-300">
                      {formatHours(h)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label="Heures par coach et par mois"
          >
            {/* Gridlines + y ticks */}
            {yTicks.map((tick) => {
              const y = yForValue(tick, yMax);
              return (
                <g key={tick}>
                  <line
                    x1={PAD_LEFT}
                    x2={WIDTH - PAD_RIGHT}
                    y1={y}
                    y2={y}
                    stroke="#2c2c2a"
                    strokeWidth={1}
                  />
                  <text x={PAD_LEFT - 8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-neutral-500 text-[10px]">
                    {tick % 1 === 0 ? tick : tick.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Baseline */}
            <line
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={yForValue(0, yMax)}
              y2={yForValue(0, yMax)}
              stroke="#383835"
              strokeWidth={1}
            />

            {/* X labels */}
            {monthLabels.map((label, i) => (
              <text
                key={label}
                x={xForMonth(i)}
                y={HEIGHT - PAD_BOTTOM + 16}
                textAnchor="middle"
                className="fill-neutral-500 text-[10px]"
              >
                {label}
              </text>
            ))}

            {/* Crosshair */}
            {hoverMonth !== null && (
              <line
                x1={xForMonth(hoverMonth)}
                x2={xForMonth(hoverMonth)}
                y1={PAD_TOP}
                y2={HEIGHT - PAD_BOTTOM}
                stroke="#52514e"
                strokeWidth={1}
              />
            )}

            {/* Lines */}
            {visibleSeries.map((s) => {
              const d = s.hours
                .map((h, i) => `${i === 0 ? "M" : "L"}${xForMonth(i)},${yForValue(h, yMax)}`)
                .join(" ");
              return (
                <path
                  key={s.id}
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              );
            })}

            {/* Hover dots */}
            {hoverMonth !== null &&
              visibleSeries.map((s) => (
                <circle
                  key={s.id}
                  cx={xForMonth(hoverMonth)}
                  cy={yForValue(s.hours[hoverMonth], yMax)}
                  r={4}
                  fill={s.color}
                  stroke="#171717"
                  strokeWidth={2}
                />
              ))}

            {/* Hover hit area */}
            <rect
              x={PAD_LEFT}
              y={PAD_TOP}
              width={INNER_WIDTH}
              height={INNER_HEIGHT}
              fill="transparent"
              onPointerMove={handlePointerMove}
              onPointerLeave={() => setHoverMonth(null)}
            />
          </svg>

          {hoverMonth !== null && visibleSeries.length > 0 && (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-[9rem] rounded-md border border-neutral-700 bg-neutral-950/95 px-3 py-2 text-xs shadow-lg"
              style={{
                left: `${(xForMonth(hoverMonth) / WIDTH) * 100}%`,
                transform:
                  hoverMonth > 8 ? "translateX(-100%)" : hoverMonth < 3 ? "translateX(0%)" : "translateX(-50%)",
              }}
            >
              <p className="mb-1 font-medium text-white">{monthLabels[hoverMonth]}</p>
              {[...visibleSeries]
                .sort((a, b) => b.hours[hoverMonth!] - a.hours[hoverMonth!])
                .map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-0.5">
                    <span className="flex items-center gap-1.5 text-neutral-400">
                      <span
                        aria-hidden
                        className="h-0.5 w-3 shrink-0 rounded"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name}
                    </span>
                    <span className="font-medium text-white">{formatHours(s.hours[hoverMonth!])}</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
