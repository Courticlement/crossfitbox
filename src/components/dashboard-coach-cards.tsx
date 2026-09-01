import Link from "next/link";

// Shared by WeekDashboard and MonthDashboard — same per-coach numbers as
// their <table>, stacked into a card instead of eight columns that don't
// fit a phone width. The two callers' row shapes differ slightly (only the
// week view has a quota), so every field but the always-present ones is
// optional.
type Row = {
  coach: { id: string; name: string };
  quota?: number | null;
  assigned: number;
  done: number;
  planned: number;
  missed?: number;
  privateDone: number;
  reviewCount: number;
  lastReviewId: string | null;
  nextClass: { id: string } | null;
  nextClassWeekStart: string | null;
  overQuota?: boolean;
  underQuota?: boolean;
  hasMissed?: boolean;
  privateOverLimit?: boolean;
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
              <Link
                href={`/admin/reviews/${r.lastReviewId}`}
                className="text-sm font-medium text-emerald-400 underline decoration-emerald-400/40 underline-offset-4"
              >
                Review {r.reviewCount}
              </Link>
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
            {r.quota != null && (
              <span
                className={`rounded-md border border-neutral-800 px-2 py-1 ${
                  r.overQuota ? "text-red-400" : "text-neutral-400"
                }`}
              >
                {r.assigned}/{r.quota}
              </span>
            )}
            <span className="rounded-md border border-neutral-800 px-2 py-1 text-emerald-400">
              {r.done} fait{r.done === 1 ? "" : "s"}
            </span>
            <span className="rounded-md border border-neutral-800 px-2 py-1 text-neutral-400">
              {r.planned} prévu{r.planned === 1 ? "" : "s"}
            </span>
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

          {(r.overQuota || r.underQuota || r.hasMissed || r.privateOverLimit) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {r.overQuota && (
                <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
                  Quota dépassé ({r.assigned}/{r.quota})
                </span>
              )}
              {r.underQuota && (
                <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs text-amber-300">
                  Quota non atteint ({r.assigned}/{r.quota})
                </span>
              )}
              {r.hasMissed && (
                <span className="rounded-full bg-red-900/40 px-2 py-0.5 text-xs text-red-300">
                  {r.missed} manqué{r.missed === 1 ? "" : "s"}
                </span>
              )}
              {r.privateOverLimit && (
                <span className="rounded-full bg-amber-900/40 px-2 py-0.5 text-xs text-amber-300">
                  {r.privateDone} cours privés
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
