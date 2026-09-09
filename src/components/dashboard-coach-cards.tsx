import Link from "next/link";
import { pastilleColor } from "@/lib/review-constants";

// Shared by WeekDashboard and MonthDashboard — same per-coach numbers as
// their <table>, stacked into a card instead of columns that don't fit a
// phone width. The two callers' row shapes differ (the week view shows
// hours, the month view shows assigned/done/planned/missed), so a row
// carries one or the other and the render branches on which is present.
type Row = {
  coach: { id: string; name: string };
  // Week view only.
  totalHours?: number;
  heuresFixes?: number;
  // Month view only.
  assigned?: number;
  done?: number;
  planned?: number;
  missed?: number;
  hasMissed?: boolean;
  privateDone: number;
  reviewCount: number;
  lastReviewId: string | null;
  reviewPastilles: string[];
  nextClass: { id: string } | null;
  nextClassWeekStart: string | null;
  netAmount: number;
};

export function DashboardCoachCards({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <p className="mb-6 rounded-lg border border-dashed border-neutral-800 py-8 text-center text-sm text-neutral-500 md:hidden">
        Aucun coach pour l&apos;instant.
      </p>
    );
  }

  return (
    <div className="mb-6 flex flex-col gap-2.5 md:hidden">
      {rows.map((r) => (
        <div key={r.coach.id} className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-white">{r.coach.name}</span>
            {r.reviewCount > 0 ? (
              <span className="flex items-center gap-2">
                <Link
                  href={`/admin/reviews/${r.lastReviewId}`}
                  className="text-sm font-medium text-emerald-400 underline decoration-emerald-400/40 underline-offset-4"
                >
                  Review {r.reviewCount}
                </Link>
                <span className="flex items-center gap-1">
                  {r.reviewPastilles.map((pastille, i) => (
                    <span
                      key={i}
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: pastilleColor(pastille) }}
                    />
                  ))}
                </span>
              </span>
            ) : r.nextClass && r.nextClassWeekStart ? (
              <Link
                href={`/admin/planning?week=${r.nextClassWeekStart}&highlight=${r.nextClass.id}`}
                className="text-sm font-medium text-amber-400 underline decoration-amber-400/40 underline-offset-4"
              >
                Review 0
              </Link>
            ) : (
              <span className="text-sm text-neutral-500">Review 0</span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {r.totalHours !== undefined ? (
              <>
                <span className="rounded-md border border-neutral-800 px-2 py-1 text-white">
                  {r.totalHours.toFixed(1)}h total
                </span>
                <span className="rounded-md border border-neutral-800 px-2 py-1 text-neutral-400">
                  {(r.heuresFixes ?? 0).toFixed(1)}h fixes
                </span>
              </>
            ) : (
              <>
                <span className="rounded-md border border-neutral-800 px-2 py-1 text-emerald-400">
                  {r.done} fait{r.done === 1 ? "" : "s"}
                </span>
                <span className="rounded-md border border-neutral-800 px-2 py-1 text-neutral-400">
                  {r.planned} prévu{r.planned === 1 ? "" : "s"}
                </span>
              </>
            )}
            {r.privateDone > 0 && (
              <span className="rounded-md border border-neutral-800 px-2 py-1 text-neutral-400">
                {r.privateDone} privé{r.privateDone === 1 ? "" : "s"}
              </span>
            )}
            <span
              className={`rounded-md border border-neutral-800 px-2 py-1 ${
                r.netAmount < 0 ? "text-red-400" : "text-emerald-400"
              }`}
            >
              {r.netAmount}€
            </span>
          </div>

          {r.hasMissed && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
                {r.missed} manqué{r.missed === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
