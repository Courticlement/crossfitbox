import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { addDays, formatDateISO, formatDayLabel, parseDateOnly, toDateOnly } from "@/lib/dates";
import { DataFilters } from "@/components/data-filters";
import { DataClassesTable } from "@/components/data-classes-table";
import { DataSubmissionsTable } from "@/components/data-submissions-table";
import { PrevWeekBanner } from "@/components/prev-week-banner";
import { statusLabel } from "@/lib/status-labels";

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

  const classRows = instances.map((inst) => ({
    id: inst.id,
    dateLabel: formatDayLabel(inst.date),
    time: `${inst.startTime}–${inst.endTime}`,
    room: inst.room,
    label: inst.label,
    type: inst.isPrivate ? "Privé" : "Collectif",
    coachName: inst.coach?.name ?? "—",
    substituteName: inst.substituteCoach?.name ?? "—",
    status: statusLabel(inst.status),
    statusColor: STATUS_COLOR[inst.status] ?? "",
  }));

  const submissionRows = submissions.map((sub) => ({
    id: sub.id,
    dateLabel: formatDayLabel(sub.classInstance.date),
    classLabel: sub.classInstance.label,
    coachName: sub.coach.name,
    status: statusLabel(sub.status),
    statusColor: STATUS_COLOR[sub.status] ?? "",
    updatedAtLabel: sub.updatedAt.toLocaleString("fr-FR", { timeZone: "UTC" }),
  }));

  return (
    <div className="text-neutral-300">
      <h1 className="mb-1 text-lg font-semibold text-white">Données</h1>
      <PrevWeekBanner />
      <p className="mb-4 text-sm text-neutral-500">
        Parcourez tous les cours enregistrés et les déclarations, et exportez
        la période ci-dessous en fichier Excel. Le mois dernier est
        sélectionné par défaut. Les onglets Coachs et Modèles de cours
        permettent de gérer ces données de référence.
      </p>

      <DataFilters
        from={fromStr}
        to={toStr}
        coachId={coachIdFilter}
        status={statusFilter}
        coaches={coaches}
      />

      <h2 className="mb-2 text-sm font-medium text-white">
        Cours ({formatDayLabel(from)} – {formatDayLabel(to)})
      </h2>
      <div className="mb-8">
        <DataClassesTable rows={classRows} />
      </div>

      <h2 className="mb-2 text-sm font-medium text-white">Déclarations</h2>
      <div className="mb-8">
        <DataSubmissionsTable rows={submissionRows} />
      </div>

      <p className="text-xs text-neutral-600">
        Vous cherchez les profils des coachs, l&apos;emploi du temps
        hebdomadaire, ou l&apos;historique des paiements de cours privés ?
        Voir{" "}
        <Link href="/admin/coaches" className="text-neutral-400 hover:text-white">
          Coachs
        </Link>
        ,{" "}
        <Link href="/admin/templates" className="text-neutral-400 hover:text-white">
          Modèles de cours
        </Link>{" "}
        et{" "}
        <Link href="/admin/payments" className="text-neutral-400 hover:text-white">
          Paiements
        </Link>
        .
      </p>
    </div>
  );
}
