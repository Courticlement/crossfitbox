import { tenantPrisma } from "@/lib/prisma";
import {
  addDays,
  addMonths,
  formatDateISO,
  formatDayLabel,
  formatMonthLabel,
  parseDateOnly,
  startOfMonth,
  toDateOnly,
} from "@/lib/dates";
import { requireOrgAdmin } from "@/lib/auth-context";
import { PrivateClassesFilters } from "@/components/private-classes-filters";
import { PrivateClassesTable } from "@/components/private-classes-table";
import { PrivateClassesChart, type PrivateClassesMonthPoint } from "@/components/private-classes-chart";

export default async function PrivateClassesPage({
  searchParams,
}: PageProps<"/admin/private-classes">) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const params = await searchParams;
  const fromParam = typeof params?.from === "string" ? params.from : undefined;
  const toParam = typeof params?.to === "string" ? params.to : undefined;
  const coachIdFilter = typeof params?.coachId === "string" ? params.coachId : "";

  const today = toDateOnly(new Date());
  const from = (fromParam && parseDateOnly(fromParam)) || addDays(today, -30);
  const to = (toParam && parseDateOnly(toParam)) || today;
  const toExclusive = addDays(to, 1);

  const [coaches, instances] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.classInstance.findMany({
      where: {
        isPrivate: true,
        date: { gte: from, lt: toExclusive },
        ...(coachIdFilter ? { coachId: coachIdFilter } : {}),
      },
      include: { coach: true },
      orderBy: [{ date: "desc" }, { startTime: "desc" }],
    }),
  ]);

  const fromStr = formatDateISO(from);
  const toStr = formatDateISO(to);

  const rows = instances.map((i) => ({
    id: i.id,
    coachName: i.coach?.name ?? "—",
    athleteName: i.athleteName ?? "—",
    athleteIsMember: i.athleteIsMember,
    dateLabel: formatDayLabel(i.date),
    time: `${i.startTime}–${i.endTime}`,
  }));

  // One point per calendar month covering the filtered range. A class whose
  // athleteIsMember was never set (logged before that field existed) counts
  // as "non abonné" so the chart always shows exactly the two lines asked
  // for, rather than a third silent bucket.
  const firstMonthStart = startOfMonth(from);
  const toMonthStart = startOfMonth(to);
  const monthCount =
    (toMonthStart.getUTCFullYear() - firstMonthStart.getUTCFullYear()) * 12 +
    (toMonthStart.getUTCMonth() - firstMonthStart.getUTCMonth()) +
    1;
  const monthPoints: PrivateClassesMonthPoint[] = Array.from({ length: monthCount }, (_, i) => ({
    label: formatMonthLabel(addMonths(firstMonthStart, i)),
    subscribed: 0,
    unsubscribed: 0,
  }));
  for (const i of instances) {
    const idx =
      (i.date.getUTCFullYear() - firstMonthStart.getUTCFullYear()) * 12 +
      (i.date.getUTCMonth() - firstMonthStart.getUTCMonth());
    if (idx < 0 || idx >= monthCount) continue;
    if (i.athleteIsMember === true) monthPoints[idx].subscribed++;
    else monthPoints[idx].unsubscribed++;
  }

  return (
    <div className="text-neutral-300">
      <h1 className="mb-1 text-lg font-semibold text-white">Cours privés</h1>
      <p className="mb-4 text-sm text-neutral-500">
        Suivi des cours privés déclarés par les coachs — athlète et statut d&apos;abonnement à la
        box. Le mois dernier est sélectionné par défaut.
      </p>

      <PrivateClassesFilters from={fromStr} to={toStr} coachId={coachIdFilter} coaches={coaches} />

      <PrivateClassesChart points={monthPoints} />

      <h2 className="mb-2 text-sm font-medium text-white">
        {rows.length} cours privé{rows.length === 1 ? "" : "s"} ({formatDayLabel(from)} –{" "}
        {formatDayLabel(to)})
      </h2>
      <PrivateClassesTable rows={rows} />
    </div>
  );
}
