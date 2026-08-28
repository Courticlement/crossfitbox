import { prisma } from "@/lib/prisma";
import {
  createCoach,
  renameCoach,
  deleteCoach,
  archiveCoach,
  unarchiveCoach,
} from "@/lib/actions/coaches";
import { computeCoachStats, type CoachStats } from "@/lib/coach-stats";
import { groupClassRate } from "@/lib/coach-levels";
import { LevelSelect } from "@/components/level-select";
import { ColorSelect } from "@/components/color-select";
import { PrevWeekBanner } from "@/components/prev-week-banner";
import { CoachPasswordForm } from "@/components/coach-password-form";
import { MarkPrivatePaidButton } from "@/components/mark-private-paid-button";
import { formatDateISO } from "@/lib/dates";

// No searchParams/cookies() here to otherwise force dynamic rendering — left
// to itself, Next statically prerenders this page at build time, freezing
// coach edits (rate, color, quota, stats) until the next deploy.
export const dynamic = "force-dynamic";

function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

function formatAmount(amount: number): string {
  return `${amount}€`;
}

function formatCost(cost: number): string {
  return cost === 0 ? "0€" : `-${cost}€`;
}

// Shared card for both the active and archived sections below — an archived
// coach keeps their stats and access-link visible (for reference / handing
// the link back if unarchived) but loses the rename form, since there's
// nothing to keep editing once they're gone.
type CoachCardData = {
  id: string;
  name: string;
  level: string | null;
  color: string | null;
  weeklyQuota: number | null;
  rate: number | null;
  passwordHash: string | null;
  archived: boolean;
  privateBalancePaidAt: Date | null;
};

function CoachCard({
  coach,
  stats,
  takenColors,
}: {
  coach: CoachCardData;
  stats: CoachStats;
  takenColors: Set<string>;
}) {
  return (
    <div
      className={`flex flex-col rounded-lg border p-4 ${
        coach.archived
          ? "border-neutral-800 bg-neutral-900/50 opacity-70"
          : "border-neutral-800 bg-neutral-900"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-white">
            {coach.color && (
              <span
                style={{ backgroundColor: coach.color }}
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                title="Planning color"
              />
            )}
            {coach.name}
            {coach.archived && (
              <span className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-neutral-500">
                Archivé
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-500">
            {coach.level || "Niveau non défini"}
            {" · "}
            {coach.weeklyQuota === null
              ? "Pas de quota standard"
              : `${coach.weeklyQuota} cours/semaine`}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {coach.archived ? (
            <form action={unarchiveCoach}>
              <input type="hidden" name="id" value={coach.id} />
              <button
                type="submit"
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white"
              >
                Désarchiver
              </button>
            </form>
          ) : (
            <form action={archiveCoach}>
              <input type="hidden" name="id" value={coach.id} />
              <button
                type="submit"
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white"
              >
                Archiver
              </button>
            </form>
          )}
          <form action={deleteCoach}>
            <input type="hidden" name="id" value={coach.id} />
            <button
              type="submit"
              className="rounded-md border border-neutral-800 px-2 py-1 text-xs text-red-400 hover:border-red-900 hover:text-red-300"
            >
              Supprimer
            </button>
          </form>
        </div>
      </div>

      <div className="mb-4 rounded-md border border-neutral-800 bg-neutral-950/40 p-2.5">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
          Accès
        </h3>
        <CoachPasswordForm
          coachId={coach.id}
          hasPassword={coach.passwordHash !== null}
          disabled={coach.archived}
        />
      </div>

      <div className="mb-4">
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
          Performance
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-neutral-500">
              <th className="text-left font-normal"> </th>
              <th className="text-right font-normal">Ce mois-ci</th>
              <th className="text-right font-normal">Mois dernier</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-xs text-neutral-500">Heures</td>
              <td className="text-right text-white">{formatHours(stats.hoursThisMonth)}</td>
              <td className="text-right text-white">{formatHours(stats.hoursLastMonth)}</td>
            </tr>
            <tr>
              <td
                className="text-xs text-neutral-500"
                title="Cours collectifs donnés lors d'une semaine que vous avez validée"
              >
                Montant
              </td>
              <td className="text-right text-white">{formatAmount(stats.amountThisMonth)}</td>
              <td className="text-right text-white">{formatAmount(stats.amountLastMonth)}</td>
            </tr>
            <tr>
              <td
                className="text-xs text-neutral-500"
                title="Dû à la box pour les cours privés donnés"
              >
                Coût privé
              </td>
              <td className="text-right text-red-400">{formatCost(stats.privateCostThisMonth)}</td>
              <td className="text-right text-red-400">{formatCost(stats.privateCostLastMonth)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-2 flex justify-between text-xs text-neutral-500">
          <span>
            Moy.{" "}
            {stats.averageHoursPerMonth === null ? "—" : formatHours(stats.averageHoursPerMonth)}
            /mois
          </span>
          <span>{stats.privateClassesDone} cours privés faits</span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-md border border-neutral-800 bg-neutral-950/40 p-2.5">
          <div>
            <div
              className="text-xs text-neutral-500"
              title="Total dû à la box pour les cours privés depuis le dernier paiement — remis à 0 par le bouton Marquer payé"
            >
              Solde privé dû
            </div>
            <div
              className={`text-sm font-medium ${stats.privateBalance === 0 ? "text-neutral-400" : "text-red-400"}`}
            >
              {formatCost(stats.privateBalance)}
            </div>
            {coach.privateBalancePaidAt && (
              <div className="text-[10px] text-neutral-600">
                Payé le {formatDateISO(coach.privateBalancePaidAt)}
              </div>
            )}
          </div>
          <MarkPrivatePaidButton coachId={coach.id} balance={stats.privateBalance} />
        </div>
      </div>

      {!coach.archived && (
        <form action={renameCoach} className="mt-auto border-t border-neutral-800 pt-3">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
            Paramètres
          </h3>
          <input type="hidden" name="id" value={coach.id} />
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-500">Nom</span>
              <input
                type="text"
                name="name"
                defaultValue={coach.name}
                className="w-full rounded border border-neutral-800 bg-transparent px-1.5 py-1 text-xs text-white hover:border-neutral-700 focus:border-neutral-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-500">Niveau</span>
              <LevelSelect name="level" defaultValue={coach.level ?? ""} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-500">Quota hebdomadaire</span>
              <input
                type="number"
                name="weeklyQuota"
                min={0}
                defaultValue={coach.weeklyQuota ?? ""}
                placeholder="—"
                title="Quota hebdomadaire standard — utilisé sur le tableau de bord pour toute semaine sans exception propre"
                className="w-full rounded border border-neutral-800 bg-transparent px-1.5 py-1 text-xs text-white hover:border-neutral-700 focus:border-neutral-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-neutral-500">Taux (€/cours)</span>
              <input
                type="number"
                name="rate"
                min={0}
                defaultValue={coach.rate ?? groupClassRate(coach.level)}
                title="€ par cours collectif validé — utilise par défaut le taux du niveau CrossFit tant qu'il n'est pas modifié"
                className="w-full rounded border border-neutral-800 bg-transparent px-1.5 py-1 text-xs text-white hover:border-neutral-700 focus:border-neutral-500 focus:outline-none"
              />
            </label>
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs text-neutral-500">Couleur du planning</span>
              <ColorSelect name="color" defaultValue={coach.color ?? ""} takenColors={takenColors} />
            </label>
          </div>
          <button
            type="submit"
            className="mt-3 w-full rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Enregistrer
          </button>
        </form>
      )}
    </div>
  );
}

export default async function CoachesPage() {
  const [coaches, instances, planningWeeks] = await Promise.all([
    prisma.coach.findMany({ orderBy: [{ archived: "asc" }, { name: "asc" }] }),
    prisma.classInstance.findMany({
      where: { OR: [{ coachId: { not: null } }, { substituteCoachId: { not: null } }] },
      select: {
        coachId: true,
        substituteCoachId: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        isPrivate: true,
      },
    }),
    prisma.planningWeek.findMany({ select: { weekStart: true } }),
  ]);

  const validatedWeekStarts = new Set(planningWeeks.map((w) => formatDateISO(w.weekStart)));

  const instancesByCoach = new Map<string, typeof instances>();
  for (const inst of instances) {
    for (const id of [inst.coachId, inst.substituteCoachId]) {
      if (!id) continue;
      const list = instancesByCoach.get(id) ?? [];
      list.push(inst);
      instancesByCoach.set(id, list);
    }
  }

  const activeCoaches = coaches.filter((c) => !c.archived);
  const archivedCoaches = coaches.filter((c) => c.archived);
  const takenColorsExcept = (coachId: string) =>
    new Set(coaches.filter((c) => c.id !== coachId && c.color).map((c) => c.color!));

  return (
    <div className="text-neutral-300">
      <h1 className="mb-4 text-lg font-semibold text-white">Coachs</h1>
      <PrevWeekBanner />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeCoaches.map((coach) => (
          <CoachCard
            key={coach.id}
            coach={coach}
            stats={computeCoachStats(
              coach.id,
              instancesByCoach.get(coach.id) ?? [],
              coach.rate ?? groupClassRate(coach.level),
              validatedWeekStarts,
              coach.privateBalancePaidAt
            )}
            takenColors={takenColorsExcept(coach.id)}
          />
        ))}
        {activeCoaches.length === 0 && (
          <p className="col-span-full py-6 text-center text-neutral-500">
            Aucun coach pour l&apos;instant.
          </p>
        )}
      </div>

      {archivedCoaches.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-medium text-neutral-500">
            Archivés ({archivedCoaches.length})
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {archivedCoaches.map((coach) => (
              <CoachCard
                key={coach.id}
                coach={coach}
                stats={computeCoachStats(
                  coach.id,
                  instancesByCoach.get(coach.id) ?? [],
                  coach.rate ?? groupClassRate(coach.level),
                  validatedWeekStarts,
                  coach.privateBalancePaidAt
                )}
                takenColors={takenColorsExcept(coach.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="max-w-sm rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-white">Ajouter un coach</h2>
        <form action={createCoach} className="flex flex-col gap-2">
          <input
            type="text"
            name="name"
            required
            placeholder="Nom"
            className="rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
          />
          <div>
            <span className="mb-1 block text-xs text-neutral-500">Niveau CrossFit</span>
            <LevelSelect name="level" defaultValue="" />
          </div>
          <div>
            <span className="mb-1 block text-xs text-neutral-500">
              Quota hebdomadaire standard
            </span>
            <input
              type="number"
              name="weeklyQuota"
              min={0}
              placeholder="ex. 10"
              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="mt-1 rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Ajouter le coach
          </button>
        </form>
      </div>
    </div>
  );
}
