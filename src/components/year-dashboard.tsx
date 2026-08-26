import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { computeMonthlyHoursByCoach } from "@/lib/coach-stats";
import { chartSeriesColor } from "@/lib/chart-palette";
import { CoachHoursChart, type CoachHoursSeries } from "@/components/coach-hours-chart";

function monthLabels(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(year, i, 1)).toLocaleDateString("fr-FR", {
      month: "short",
      timeZone: "UTC",
    })
  );
}

export async function YearDashboard({ yearParam }: { yearParam?: string }) {
  const currentYear = new Date().getUTCFullYear();
  const parsedYear = yearParam ? Number.parseInt(yearParam, 10) : NaN;
  const year = Number.isInteger(parsedYear) ? parsedYear : currentYear;

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const [coaches, instances] = await Promise.all([
    prisma.coach.findMany({ where: { archived: false }, orderBy: { name: "asc" } }),
    prisma.classInstance.findMany({
      where: { date: { gte: yearStart, lt: yearEnd }, status: { in: ["DONE", "MISSED"] } },
      select: {
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        coachId: true,
        substituteCoachId: true,
      },
    }),
  ]);

  const hoursByCoach = computeMonthlyHoursByCoach(instances, year);

  const series: CoachHoursSeries[] = coaches.map((coach, i) => ({
    id: coach.id,
    name: coach.name,
    color: chartSeriesColor(i),
    hours: hoursByCoach.get(coach.id) ?? new Array(12).fill(0),
  }));

  return (
    <>
      <div className="mb-6 flex items-center gap-3 text-sm">
        <Link href={`/admin?view=year&year=${year - 1}`} className="text-neutral-400 hover:text-white">
          ← Préc.
        </Link>
        <span className="text-neutral-500">{year}</span>
        <Link href={`/admin?view=year&year=${year + 1}`} className="text-neutral-400 hover:text-white">
          Suivant →
        </Link>
      </div>

      <h2 className="mb-3 text-sm font-medium text-neutral-400">Heures par coach et par mois</h2>
      <CoachHoursChart monthLabels={monthLabels(year)} series={series} />
    </>
  );
}
