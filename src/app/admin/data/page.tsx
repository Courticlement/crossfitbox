import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateISO, formatDayLabel, parseDateOnly, toDateOnly } from "@/lib/dates";
import { DataFilters } from "@/components/data-filters";
import { PrevWeekBanner } from "@/components/prev-week-banner";

const STATUS_COLOR: Record<string, string> = {
  DONE: "text-emerald-400",
  MISSED: "text-red-400",
  PLANNED: "text-neutral-400",
  CANCELLED: "text-neutral-600",
};

export default async function DataPage({
  searchParams,
}: PageProps<"/admin/data">) {
  const params = await searchParams;
  const fromParam = typeof params?.from === "string" ? params.from : undefined;
  const toParam = typeof params?.to === "string" ? params.to : undefined;
  const coachIdFilter = typeof params?.coachId === "string" ? params.coachId : "";
  const statusFilter = typeof params?.status === "string" ? params.status : "";

  const today = toDateOnly(new Date());
  const from = (fromParam && parseDateOnly(fromParam)) || addDays(today, -30);
  const to = (toParam && parseDateOnly(toParam)) || today;
  const toExclusive = addDays(to, 1);

  const instanceWhere = {
    date: { gte: from, lt: toExclusive },
    ...(coachIdFilter === "none"
      ? { coachId: null }
      : coachIdFilter
        ? { coachId: coachIdFilter }
        : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [coaches, instances, submissions] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.classInstance.findMany({
      where: instanceWhere,
      include: { coach: true, substituteCoach: true },
      orderBy: [{ date: "desc" }, { startTime: "asc" }],
    }),
    prisma.classSubmission.findMany({
      where: { classInstance: { date: { gte: from, lt: toExclusive } } },
      include: { coach: true, classInstance: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const fromStr = formatDateISO(from);
  const toStr = formatDateISO(to);

  return (
    <div className="text-neutral-300">
      <h1 className="mb-1 text-lg font-semibold text-white">Data</h1>
      <PrevWeekBanner />
      <p className="mb-4 text-sm text-neutral-500">
        Browse every recorded class and self-report, and export the range
        below as an Excel workbook. Defaults to the past month. Coaches and
        Class Templates have their own tabs for managing that reference data.
      </p>

      <DataFilters
        from={fromStr}
        to={toStr}
        coachId={coachIdFilter}
        status={statusFilter}
        coaches={coaches}
      />

      <h2 className="mb-2 text-sm font-medium text-white">
        Classes ({formatDayLabel(from)} – {formatDayLabel(to)})
      </h2>
      <div className="mb-8 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Time</th>
              <th className="px-4 py-2 font-medium">Room</th>
              <th className="px-4 py-2 font-medium">Label</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Coach</th>
              <th className="px-4 py-2 font-medium">Substitute</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((inst) => (
              <tr key={inst.id} className="border-t border-neutral-800">
                <td className="px-4 py-2 whitespace-nowrap">{formatDayLabel(inst.date)}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {inst.startTime}–{inst.endTime}
                </td>
                <td className="px-4 py-2">{inst.room}</td>
                <td className="px-4 py-2 text-white">{inst.label}</td>
                <td className="px-4 py-2">{inst.isPrivate ? "Private" : "Group"}</td>
                <td className="px-4 py-2">{inst.coach?.name ?? "—"}</td>
                <td className="px-4 py-2">{inst.substituteCoach?.name ?? "—"}</td>
                <td className={`px-4 py-2 ${STATUS_COLOR[inst.status] ?? ""}`}>
                  {inst.status}
                </td>
              </tr>
            ))}
            {instances.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-neutral-500">
                  No classes in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <h2 className="mb-2 text-sm font-medium text-white">Self-reports</h2>
      <div className="mb-8 overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Class date</th>
              <th className="px-4 py-2 font-medium">Class</th>
              <th className="px-4 py-2 font-medium">Coach</th>
              <th className="px-4 py-2 font-medium">Reported</th>
              <th className="px-4 py-2 font-medium">Last updated</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub) => (
              <tr key={sub.id} className="border-t border-neutral-800">
                <td className="px-4 py-2 whitespace-nowrap">
                  {formatDayLabel(sub.classInstance.date)}
                </td>
                <td className="px-4 py-2 text-white">{sub.classInstance.label}</td>
                <td className="px-4 py-2">{sub.coach.name}</td>
                <td className={`px-4 py-2 ${STATUS_COLOR[sub.status] ?? ""}`}>
                  {sub.status}
                </td>
                <td className="px-4 py-2 text-neutral-500">
                  {sub.updatedAt.toLocaleString("en-US", { timeZone: "UTC" })}
                </td>
              </tr>
            ))}
            {submissions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-neutral-500">
                  No self-reports in this range.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-600">
        Looking for coach profiles or the weekly timetable? See{" "}
        <Link href="/admin/coaches" className="text-neutral-400 hover:text-white">
          Coaches
        </Link>{" "}
        and{" "}
        <Link href="/admin/templates" className="text-neutral-400 hover:text-white">
          Class Templates
        </Link>
        .
      </p>
    </div>
  );
}
