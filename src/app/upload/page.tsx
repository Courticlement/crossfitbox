import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  startOfWeekMonday,
  addDays,
  formatDateISO,
  formatDayLabel,
  parseDateOnly,
  toDateOnly,
  isoWeekday,
} from "@/lib/dates";
import { PrivateClassForm } from "@/components/private-class-form";
import { UnavailabilityForm } from "@/components/unavailability-form";
import { MyClassesGrid } from "@/components/my-classes-grid";
import { CoachPrevWeekBanner } from "@/components/coach-prev-week-banner";
import { coachLogout } from "@/lib/actions/auth";
import { loadCoachWeekData } from "@/lib/coach-upload-data";
import { COACH_COOKIE, verifyCoachSessionToken } from "@/lib/session";

export default async function UploadPage({
  searchParams,
}: PageProps<"/upload">) {
  const params = await searchParams;
  const weekParam = typeof params?.week === "string" ? params.week : undefined;

  // middleware.ts already redirects an unauthenticated request to /login
  // before this ever renders — this re-check just satisfies TypeScript
  // (coachId isn't threaded through as a prop) and guards the narrow window
  // where a session is revoked between the middleware check and this render.
  const coachId = await verifyCoachSessionToken((await cookies()).get(COACH_COOKIE)?.value);
  if (!coachId) redirect("/login");

  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  if (!coach || coach.archived) redirect("/login");

  // A coach's own view is deliberately narrow — last week, this week, and
  // (from Friday of this week onward, once the admin has typically finished
  // planning it) next week. Keeps them focused on what's actionable instead
  // of wandering arbitrarily far into the past or future.
  const today = toDateOnly(new Date());
  const thisWeekStart = startOfWeekMonday(today);
  const minWeekStart = addDays(thisWeekStart, -7);
  const maxWeekStart = isoWeekday(today) >= 5 ? addDays(thisWeekStart, 7) : thisWeekStart;

  const requested = (weekParam && parseDateOnly(weekParam)) || today;
  let weekStart = startOfWeekMonday(requested);
  if (weekStart < minWeekStart) weekStart = minWeekStart;
  if (weekStart > maxWeekStart) weekStart = maxWeekStart;
  const weekEnd = addDays(weekStart, 7);
  const hasPrev = weekStart > minWeekStart;
  const hasNext = weekStart < maxWeekStart;
  const prevWeek = formatDateISO(addDays(weekStart, -7));
  const nextWeek = formatDateISO(addDays(weekStart, 7));

  const coaches = await prisma.coach.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });

  const [{ instances, myPrivateClasses, locked }, myUnavailability] =
    await Promise.all([
      loadCoachWeekData(coach.id, weekStart, weekEnd),
      prisma.unavailability.findMany({
        where: {
          coachId: coach.id,
          OR: [{ recurring: true }, { endDate: { gte: toDateOnly(new Date()) } }],
        },
        select: { id: true, startDate: true, endDate: true, recurring: true, note: true },
        orderBy: { startDate: "asc" },
      }),
    ]);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3">
          <span className="text-sm font-semibold text-white">
            Crossfit Box — Mes cours
          </span>
          <form action={coachLogout} className="ml-auto">
            <button type="submit" className="text-sm text-neutral-400 hover:text-white">
              Se déconnecter
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 text-neutral-300">
        <h1 className="mb-1 text-lg font-semibold text-white">
          Cours de {coach.name}
        </h1>
        <p className="mb-4 text-sm text-neutral-500">
          Vous verrez ci-dessous vos cours de la semaine, ainsi que ceux
          encore non assignés. Le statut (Fait / Manqué) de chaque cours est
          validé par l&apos;admin. Si l&apos;un de vos cours est marqué
          Manqué, vous pouvez indiquer directement qui l&apos;a couvert.
        </p>

        <div className="mb-6">
          <div className="flex items-center gap-3 text-sm">
            {hasPrev ? (
              <Link href={`/upload?week=${prevWeek}`} className="text-neutral-400 hover:text-white">
                ← Préc.
              </Link>
            ) : (
              <span className="text-neutral-700">← Préc.</span>
            )}
            <span className="text-neutral-500">
              Semaine du {formatDayLabel(weekStart)} – {formatDayLabel(addDays(weekStart, 6))}
            </span>
            {hasNext ? (
              <Link href={`/upload?week=${nextWeek}`} className="text-neutral-400 hover:text-white">
                Suivant →
              </Link>
            ) : (
              <span className="text-neutral-700">Suivant →</span>
            )}
          </div>
          {!hasNext && (
            <p className="mt-1 text-xs text-neutral-600">
              Le planning de la semaine prochaine s&apos;ouvre à partir de vendredi.
            </p>
          )}
        </div>

        <CoachPrevWeekBanner coachId={coach.id} />

        <UnavailabilityForm coachId={coach.id} entries={myUnavailability} />

        {locked && (
          <p className="mb-6 rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-300">
            Le planning de cette semaine a été validé par l&apos;admin — les
            modifications sont fermées. Contactez l&apos;admin si quelque
            chose doit changer.
          </p>
        )}

        <PrivateClassForm
          coachId={coach.id}
          weekStart={weekStart}
          entries={myPrivateClasses}
          locked={locked}
        />

        {instances.length > 0 ? (
          <MyClassesGrid
            weekStart={weekStart}
            instances={instances}
            coachId={coach.id}
            coaches={coaches}
            locked={locked}
          />
        ) : (
          <p className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500">
            Aucun cours cette semaine.
          </p>
        )}
      </main>
    </div>
  );
}
