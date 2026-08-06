export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatHourLabel(hour: number): string {
  const h = ((hour + 11) % 12) + 1;
  const suffix = hour < 12 || hour === 24 ? "AM" : "PM";
  return `${h} ${suffix}`;
}

export type GridPlacedEvent<T> = {
  item: T;
  rowStart: number;
  rowEnd: number;
  left: number;
  width: number;
};

/**
 * Lays out same-day events onto a CSS Grid time axis: rowStart/rowEnd are
 * 1-indexed grid line numbers (for `grid-row: rowStart / rowEnd`), computed
 * in fixed-size slots (slotMinutes each) from rangeStartMinutes. Overlapping
 * events (e.g. two rooms running at once) get split into side-by-side
 * left/width percentages rather than stacked, same as Google Calendar.
 */
export function layoutDayEventsToGrid<T extends { startTime: string; endTime: string }>(
  events: T[],
  rangeStartMinutes: number,
  slotMinutes: number
): GridPlacedEvent<T>[] {
  const toRow = (minutes: number) =>
    1 + Math.round((minutes - rangeStartMinutes) / slotMinutes);

  const withMinutes = events
    .map((event) => ({
      event,
      start: timeToMinutes(event.startTime),
      end: timeToMinutes(event.endTime),
    }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const clusters: (typeof withMinutes)[] = [];
  let current: typeof withMinutes = [];
  let currentEnd = -Infinity;
  for (const entry of withMinutes) {
    if (current.length > 0 && entry.start >= currentEnd) {
      clusters.push(current);
      current = [];
      currentEnd = -Infinity;
    }
    current.push(entry);
    currentEnd = Math.max(currentEnd, entry.end);
  }
  if (current.length > 0) clusters.push(current);

  const results: GridPlacedEvent<T>[] = [];
  for (const cluster of clusters) {
    const columnEnds: number[] = [];
    const columnByIndex = new Map<number, number>();
    cluster.forEach((entry, idx) => {
      let placed = false;
      for (let col = 0; col < columnEnds.length; col++) {
        if (columnEnds[col] <= entry.start) {
          columnEnds[col] = entry.end;
          columnByIndex.set(idx, col);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columnEnds.push(entry.end);
        columnByIndex.set(idx, columnEnds.length - 1);
      }
    });

    const totalCols = columnEnds.length;
    cluster.forEach((entry, idx) => {
      const col = columnByIndex.get(idx) ?? 0;
      const rowStart = toRow(entry.start);
      const rowEnd = Math.max(toRow(entry.end), rowStart + 1);
      results.push({
        item: entry.event,
        rowStart,
        rowEnd,
        left: (col / totalCols) * 100,
        width: (1 / totalCols) * 100,
      });
    });
  }
  return results;
}
