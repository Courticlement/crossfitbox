import Link from "next/link";
import { addDays, formatDateISO, formatDayLabel } from "@/lib/dates";
import { getPrevWeekAlert } from "@/lib/prev-week-alert";

// Standing reminder shown near the top of every admin tab (besides the
// Dashboard, which gets a more prominent version of the same alert — see
// PrevWeekAlertCard) when last week's planning still hasn't been validated.
export async function PrevWeekBanner() {
  const { show, prevWeekStart, unreported } = await getPrevWeekAlert();
  if (!show) return null;

  return (
    <p className="mb-6 rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-300">
      ⚠ Last week ({formatDayLabel(prevWeekStart)} –{" "}
      {formatDayLabel(addDays(prevWeekStart, 6))}) hasn&apos;t been validated
      yet
      {unreported > 0 &&
        ` — ${unreported} class${unreported === 1 ? "" : "es"} not reported by coaches`}
      .{" "}
      <Link
        href={`/admin/planning?week=${formatDateISO(prevWeekStart)}`}
        className="font-medium text-amber-100 underline hover:text-white"
      >
        Review &amp; validate →
      </Link>
    </p>
  );
}
