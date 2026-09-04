import Link from "next/link";
import { addDays, formatDateISO, formatDayLabel } from "@/lib/dates";
import { validateWeek } from "@/lib/actions/planning";
import { getPrevWeekAlert } from "@/lib/prev-week-alert";
import { WeekDashboard } from "@/components/week-dashboard";
import { MonthDashboard } from "@/components/month-dashboard";
import { YearDashboard } from "@/components/year-dashboard";
import { UnavailabilityAlert } from "@/components/unavailability-alert";
import { requireOrgAdmin } from "@/lib/auth-context";

function tabClass(active: boolean): string {
  return `rounded px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-white text-neutral-950" : "text-neutral-400 hover:text-white"
  }`;
}

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  const params = await searchParams;
  const rawView = typeof params?.view === "string" ? params.view : undefined;
  const view = rawView === "month" ? "month" : rawView === "year" ? "year" : "week";
  const weekParam = typeof params?.week === "string" ? params.week : undefined;
  const monthParam = typeof params?.month === "string" ? params.month : undefined;
  const yearParam = typeof params?.year === "string" ? params.year : undefined;
  const digestStatus = typeof params?.digest === "string" ? params.digest : undefined;

  const { organizationId } = await requireOrgAdmin();
  const prevWeekAlert = await getPrevWeekAlert(organizationId);

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
                  ? "Les coachs n'ont pas fini de déclarer la semaine dernière"
                  : "La semaine dernière est prête à être validée"}
              </h2>
              <p className="mt-1 text-sm text-red-200">
                {formatDayLabel(prevWeekAlert.prevWeekStart)} –{" "}
                {formatDayLabel(addDays(prevWeekAlert.prevWeekStart, 6))}
                {prevWeekAlert.unreported > 0
                  ? ` — ${prevWeekAlert.unreported} cours encore non déclaré${prevWeekAlert.unreported === 1 ? "" : "s"}.`
                  : " — tous les cours sont déclarés. Validez pour la verrouiller."}
              </p>
            </div>
          </div>
          <div className="shrink-0">
            {prevWeekAlert.unreported > 0 ? (
              <Link
                href={`/admin/planning?week=${formatDateISO(prevWeekAlert.prevWeekStart)}`}
                className="inline-flex items-center gap-1 rounded-md bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500"
              >
                Vérifier →
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
                  Valider →
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <UnavailabilityAlert organizationId={organizationId} />

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Tableau de bord</h1>
        <div className="flex items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 p-1">
          <Link href="/admin?view=week" className={tabClass(view === "week")}>
            Semaine
          </Link>
          <Link href="/admin?view=month" className={tabClass(view === "month")}>
            Mois
          </Link>
          <Link href="/admin?view=year" className={tabClass(view === "year")}>
            Année
          </Link>
        </div>
      </div>

      {view === "week" ? (
        <WeekDashboard
          organizationId={organizationId}
          weekParam={weekParam}
          digestStatus={digestStatus}
        />
      ) : view === "month" ? (
        <MonthDashboard organizationId={organizationId} monthParam={monthParam} />
      ) : (
        <YearDashboard organizationId={organizationId} yearParam={yearParam} />
      )}
    </div>
  );
}
