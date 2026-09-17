"use client";

import { useState } from "react";

export type PrivateClassesMonthPoint = {
  label: string; // e.g. "septembre 2026"
  subscribed: number;
  unsubscribed: number;
};

// Fixed categorical slots 1 (blue) and 2 (orange) from the app's validated
// dark-mode palette — chosen in that order (not picked to "look nice") and
// checked with the dataviz skill's validator: worst adjacent CVD ΔE 26.8,
// normal-vision ΔE 31.8, both well clear of the 8/15 floors.
const COLOR_SUBSCRIBED = "#3987e5";
const COLOR_UNSUBSCRIBED = "#d95926";
const SURFACE = "#171717"; // matches the card's bg-neutral-900 ring color

const PAD_LEFT = 30;
const PAD_RIGHT = 108; // room for the two end-of-line value labels
const PAD_TOP = 16;
const PAD_BOTTOM = 26;
const WIDTH = 860;
const HEIGHT = 240;
const INNER_WIDTH = WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_HEIGHT = HEIGHT - PAD_TOP - PAD_BOTTOM;

// Nice integer step for a count axis (counts are always whole numbers, so
// ticks must be too — unlike the hours charts' decimal steps).
function niceStep(maxValue: number, targetTicks = 4): number {
  if (maxValue <= 0) return 1;
  const rough = maxValue / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const residual = rough / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return Math.max(1, Math.round(niceResidual * magnitude));
}

export function PrivateClassesChart({ points }: { points: PrivateClassesMonthPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const totalClasses = points.reduce((sum, p) => sum + p.subscribed + p.unsubscribed, 0);
  if (totalClasses === 0) {
    return (
      <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <h3 className="text-sm font-semibold text-white">Cours privés par mois</h3>
        <p className="mt-2 text-xs text-neutral-500">
          Aucun cours privé sur cette période pour tracer une évolution.
        </p>
      </div>
    );
  }

  const lastIndex = Math.max(1, points.length - 1);
  const maxCount = Math.max(1, ...points.map((p) => Math.max(p.subscribed, p.unsubscribed)));
  const step = niceStep(maxCount);
  const yMax = Math.ceil(maxCount / step) * step;
  const yTicks: number[] = [];
  for (let v = 0; v <= yMax; v += step) yTicks.push(v);

  function xFor(i: number): number {
    return PAD_LEFT + (i / lastIndex) * INNER_WIDTH;
  }
  function yFor(v: number): number {
    return PAD_TOP + INNER_HEIGHT - (v / yMax) * INNER_HEIGHT;
  }

  function pathFor(values: number[]): string {
    return values.map((v, i) => `${i === 0 ? "M" : "L"}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ");
  }

  const subscribedValues = points.map((p) => p.subscribed);
  const unsubscribedValues = points.map((p) => p.unsubscribed);
  const lastSubscribed = subscribedValues[subscribedValues.length - 1];
  const lastUnsubscribed = unsubscribedValues[unsubscribedValues.length - 1];

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, relX / rect.width));
    setHoverIndex(Math.round(ratio * lastIndex));
  }

  return (
    <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Cours privés par mois</h3>
        <p className="text-[11.5px] text-neutral-500">Abonné à la box vs athlète non abonné</p>
      </div>

      <div className="relative mt-2">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="block w-full overflow-visible"
          role="img"
          aria-label="Nombre de cours privés par semaine, athlètes abonnés vs non abonnés"
        >
          {yTicks.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="#2c2c2a" strokeWidth={1} />
                <text x={PAD_LEFT - 8} y={y} textAnchor="end" dominantBaseline="middle" className="fill-neutral-500 text-[10px]">
                  {tick}
                </text>
              </g>
            );
          })}

          {points.map((p, i) => (
            <text
              key={p.label}
              x={xFor(i)}
              y={HEIGHT - PAD_BOTTOM + 16}
              textAnchor="middle"
              className="fill-neutral-500 text-[10px]"
            >
              {p.label}
            </text>
          ))}

          {hoverIndex !== null && (
            <line
              x1={xFor(hoverIndex)}
              x2={xFor(hoverIndex)}
              y1={PAD_TOP}
              y2={HEIGHT - PAD_BOTTOM}
              stroke="#52514e"
              strokeWidth={1}
            />
          )}

          <path d={pathFor(subscribedValues)} fill="none" stroke={COLOR_SUBSCRIBED} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathFor(unsubscribedValues)} fill="none" stroke={COLOR_UNSUBSCRIBED} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {hoverIndex !== null && (
            <>
              <circle cx={xFor(hoverIndex)} cy={yFor(subscribedValues[hoverIndex])} r={5} fill={COLOR_SUBSCRIBED} stroke={SURFACE} strokeWidth={2} />
              <circle cx={xFor(hoverIndex)} cy={yFor(unsubscribedValues[hoverIndex])} r={5} fill={COLOR_UNSUBSCRIBED} stroke={SURFACE} strokeWidth={2} />
            </>
          )}

          {/* End-of-line value labels — the mark carries the color, the
              number stays in text ink (never colored text; see
              dataviz skill's marks-and-anatomy.md). */}
          <circle cx={xFor(lastIndex)} cy={yFor(lastSubscribed)} r={5} fill={COLOR_SUBSCRIBED} stroke={SURFACE} strokeWidth={2} />
          <text x={xFor(lastIndex) + 10} y={yFor(lastSubscribed) + 4} fontSize={12} fontWeight={600} className="fill-neutral-200">
            {lastSubscribed}
          </text>
          <circle cx={xFor(lastIndex)} cy={yFor(lastUnsubscribed)} r={5} fill={COLOR_UNSUBSCRIBED} stroke={SURFACE} strokeWidth={2} />
          <text x={xFor(lastIndex) + 10} y={yFor(lastUnsubscribed) + 4} fontSize={12} fontWeight={600} className="fill-neutral-200">
            {lastUnsubscribed}
          </text>

          <rect
            x={PAD_LEFT}
            y={PAD_TOP}
            width={INNER_WIDTH}
            height={INNER_HEIGHT}
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          />
        </svg>

        {hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-[10rem] rounded-md border border-neutral-700 bg-neutral-950/95 px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(xFor(hoverIndex) / WIDTH) * 100}%`,
              transform:
                hoverIndex > lastIndex - 2
                  ? "translateX(-100%)"
                  : hoverIndex < 2
                    ? "translateX(0%)"
                    : "translateX(-50%)",
            }}
          >
            <p className="mb-1 font-medium text-white">{points[hoverIndex].label}</p>
            <div className="flex items-center justify-between gap-3 py-0.5">
              <span className="flex items-center gap-1.5 text-neutral-400">
                <span aria-hidden className="h-0.5 w-3 shrink-0 rounded" style={{ backgroundColor: COLOR_SUBSCRIBED }} />
                Abonné à la box
              </span>
              <span className="font-medium text-white">{subscribedValues[hoverIndex]}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-0.5">
              <span className="flex items-center gap-1.5 text-neutral-400">
                <span aria-hidden className="h-0.5 w-3 shrink-0 rounded" style={{ backgroundColor: COLOR_UNSUBSCRIBED }} />
                Non abonné
              </span>
              <span className="font-medium text-white">{unsubscribedValues[hoverIndex]}</span>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-3.5 border-t border-neutral-800 pt-2.5">
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-400">
          <i aria-hidden className="inline-block h-0.5 w-3.5 rounded" style={{ background: COLOR_SUBSCRIBED }} />
          Abonné à la box
        </span>
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-neutral-400">
          <i aria-hidden className="inline-block h-0.5 w-3.5 rounded" style={{ background: COLOR_UNSUBSCRIBED }} />
          Non abonné
        </span>
      </div>
    </div>
  );
}
