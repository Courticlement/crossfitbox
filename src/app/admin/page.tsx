import Link from "next/link";
import { addDays, formatDateISO, formatDayLabel } from "@/lib/dates";
import { validateWeek } from "@/lib/actions/planning";
import { getPrevWeekAlert } from "@/lib/prev-week-alert";
import { WeekDashboard } from "@/components/week-dashboard";
import { MonthDashboard } from "@/components/month-dashboard";

function tabClass(active: boolean): string {
  return `rounded px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-white text-neutral-950" : "text-neutral-400 hover:text-white"
  }`;
}

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  const params = await searchParams;
  const view = typeof params?.view === "string" && params.view === "month" ? "month" : "week";
  const weekParam = typeof params?.week === "string" ? params.week : undefined;
  const monthParam = typeof params?.month === "string" ? params.month : undefined;
  const digestStatus = typeof params?.digest === "string" ? params.digest : undefined;

  const prevWeekAlert = await getPrevWeekAlert();

  return (
    <div className="text-neutral-300">
      {prevWeekAlert.show && (
        <div className="mb-6 flex flex-col gap-4 rounded-xl border-2 border-red-600 bg-red-950 p-5 shadow-lg shadow-red-950/50 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-lg text-white">
              !
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">
                {prevWeekAlert.unreported > 0
                  ? "Coaches haven't finished reporting last week"
                  : "Last week is ready to validate"}
              </h2>
              <p className="mt-1 text-sm text-red-200">
                {formatDayLabel(prevWeekAlert.prevWeekStart)} –{" "}
                {formatDayLabel(addDays(prevWeekAlert.prevWeekStart, 6))}
                {prevWeekAlert.unreported > 0
                  ? ` — ${prevWeekAlert.unreported} class${prevWeekAlert.unreported === 1 ? "" : "es"} still not reported.`
                  : " — every class is reported. Validate to lock it in."}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {prevWeekAlert.unreported > 0 ? (
              <Link
                href={`/admin/planning?week=${formatDateISO(prevWeekAlert.prevWeekStart)}`}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
              >
                Review →
              </Link>
            ) : (
              <form action={validateWeek}>
                <input
                  type="hidden"
                  name="weekStart"
                  value={formatDateISO(prevWeekAlert.prevWeekStart)}
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
                >
                  Validate →
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
        <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1">
          <Link href="/admin?view=week" className={tabClass(view === "week")}>
            Week
          </Link>
          <Link href="/admin?view=month" className={tabClass(view === "month")}>
            Month
          </Link>
        </div>
      </div>

      {view === "week" ? (
        <WeekDashboard weekParam={weekParam} digestStatus={digestStatus} />
      ) : (
        <MonthDashboard monthParam={monthParam} />
      )}
    </div>
  );
}
