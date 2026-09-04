import Link from "next/link";
import { tenantPrisma } from "@/lib/prisma";
import { computeCoachStats, type ClassInstanceForStats } from "@/lib/coach-stats";

// Shown on the Paiements page: coaches who still owe money for private
// classes delivered last calendar month (see privateBalanceLastMonth) — the
// monthly nudge to actually go collect, as opposed to the running "Solde
// privé dû" on each coach's card, which doesn't call out that it's overdue
// by a full month.
export async function PrivatePaymentAlert({ organizationId }: { organizationId: string }) {
  const prisma = tenantPrisma(organizationId);
  const [coaches, instances] = await Promise.all([
    prisma.coach.findMany({ where: { archived: false } }),
    prisma.classInstance.findMany({
      where: {
        isPrivate: true,
        OR: [{ coachId: { not: null } }, { substituteCoachId: { not: null } }],
      },
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
  ]);

  const instancesByCoach = new Map<string, ClassInstanceForStats[]>();
  for (const inst of instances) {
    for (const id of [inst.coachId, inst.substituteCoachId]) {
      if (!id) continue;
      const list = instancesByCoach.get(id) ?? [];
      list.push(inst);
      instancesByCoach.set(id, list);
    }
  }

  const owing = coaches
    .map((coach) => ({
      coach,
      // rate/validatedWeekStarts are irrelevant here — only the private-class
      // fields of the result are used.
      amount: computeCoachStats(
        coach.id,
        instancesByCoach.get(coach.id) ?? [],
        0,
        new Set<string>(),
        coach.privateBalancePaidAt
      ).privateBalanceLastMonth,
    }))
    .filter((entry) => entry.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  if (owing.length === 0) return null;

  return (
    <div className="mb-6 rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-300">
      <p className="mb-2 font-medium text-amber-200">
        {owing.length === 1
          ? "1 coach n'a pas encore réglé ses cours privés du mois dernier"
          : `${owing.length} coachs n'ont pas encore réglé leurs cours privés du mois dernier`}
      </p>
      <ul className="flex flex-col gap-1.5">
        {owing.map(({ coach, amount }) => (
          <li
            key={coach.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-900/60 bg-amber-950/40 px-2 py-1.5"
          >
            <strong className="text-amber-100">{coach.name}</strong>
            <span className="font-medium text-amber-100">{amount}€</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-400">
        Réglez depuis{" "}
        <Link href="/admin/coaches" className="underline hover:text-white">
          la page Coachs
        </Link>
        .
      </p>
    </div>
  );
}
