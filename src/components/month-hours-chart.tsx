"use client";

import { useMemo, useState } from "react";

export type CoachWeeklyHours = {
  id: string;
  name: string;
  color: string;
  totalHours: number[]; // one entry per week of the month
  heuresFixes: number[]; // one entry per week of the month
};

type Metric = "total" | "fixes";

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

export function MonthHoursChart({
  weekLabels,
  series,
}: {
  weekLabels: string[]; // one per week of the month, chronological
  series: CoachWeeklyHours[];
}) {
  const [metric, setMetric] = useState<Metric>("total");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);

  const lastIndex = Math.max(1, weekLabels.length - 1);

  function xForWeek(index: number): number {
    return PAD_LEFT + (index / lastIndex) * INNER_WIDTH;
  }

  function yForValue(value: number, yMax: number): number {
    return PAD_TOP + INNER_HEIGHT - (value / yMax) * INNER_HEIGHT;
  }

  function valuesOf(s: CoachWeeklyHours): number[] {
    return metric === "total" ? s.totalHours : s.heuresFixes;
  }

  const visibleSeries = series.filter((s) => !hiddenIds.has(s.id));

  const yMax = useMemo(() => {
    const max = Math.max(0, ...visibleSeries.flatMap((s) => valuesOf(s)));
    return niceCeil(max * 1.1 || 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSeries, metric]);

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
    setHoverWeek(Math.round(ratio * lastIndex));
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
        <div
          role="group"
          aria-label="Choix de la mesure"
          className="inline-flex rounded-md border border-neutral-700 p-0.5"
        >
          <button
            type="button"
            onClick={() => setMetric("total")}
            aria-pressed={metric === "total"}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              metric === "total" ? "bg-white text-neutral-950" : "text-neutral-400 hover:text-white"
            }`}
          >
            Heure total
          </button>
          <button
            type="button"
            onClick={() => setMetric("fixes")}
            aria-pressed={metric === "fixes"}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              metric === "fixes" ? "bg-white text-neutral-950" : "text-neutral-400 hover:text-white"
            }`}
          >
            Heures fixes
          </button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
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
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          role="img"
          aria-label="Heures par coach et par semaine"
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
          {weekLabels.map((label, i) => (
            <text
              key={label}
              x={xForWeek(i)}
              y={HEIGHT - PAD_BOTTOM + 16}
              textAnchor="middle"
              className="fill-neutral-500 text-[10px]"
            >
              {label}
            </text>
          ))}

          {/* Crosshair */}
          {hoverWeek !== null && (
            <line
              x1={xForWeek(hoverWeek)}
              x2={xForWeek(hoverWeek)}
              y1={PAD_TOP}
              y2={HEIGHT - PAD_BOTTOM}
              stroke="#52514e"
              strokeWidth={1}
            />
          )}

          {/* Lines */}
          {visibleSeries.map((s) => {
            const values = valuesOf(s);
            const d = values
              .map((v, i) => `${i === 0 ? "M" : "L"}${xForWeek(i)},${yForValue(v, yMax)}`)
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
          {hoverWeek !== null &&
            visibleSeries.map((s) => (
              <circle
                key={s.id}
                cx={xForWeek(hoverWeek)}
                cy={yForValue(valuesOf(s)[hoverWeek], yMax)}
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
            onPointerLeave={() => setHoverWeek(null)}
          />
        </svg>

        {hoverWeek !== null && visibleSeries.length > 0 && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[9rem] rounded-md border border-neutral-700 bg-neutral-950/95 px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(xForWeek(hoverWeek) / WIDTH) * 100}%`,
              transform:
                hoverWeek > lastIndex - 2
                  ? "translateX(-100%)"
                  : hoverWeek < 2
                    ? "translateX(0%)"
                    : "translateX(-50%)",
            }}
          >
            <p className="mb-1 font-medium text-white">{weekLabels[hoverWeek]}</p>
            {[...visibleSeries]
              .sort((a, b) => valuesOf(b)[hoverWeek!] - valuesOf(a)[hoverWeek!])
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
                  <span className="font-medium text-white">{formatHours(valuesOf(s)[hoverWeek!])}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
