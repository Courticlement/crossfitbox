// Fixed-order categorical palette for multi-series charts on the (dark-only)
// admin dashboard. Assigned by position, never cycled — see
// CoachHoursChart. Validated against the app's dark surface
// (bg-neutral-950, #0a0a0a): all 8 slots clear the CVD-separation,
// normal-vision-floor, and contrast checks (dataviz skill's
// validate_palette.js, --mode dark --surface "#0a0a0a").
export const CHART_SERIES_COLORS = [
  "#3987e5", // blue
  "#d95926", // orange
  "#199e70", // aqua
  "#c98500", // yellow
  "#d55181", // magenta
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
] as const;

export function chartSeriesColor(index: number): string {
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
}
