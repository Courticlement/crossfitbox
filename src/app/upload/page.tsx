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
} from "@/lib/dates";
import { PrivateClassForm } from "@/components/private-class-form";
import { UnavailabilityForm } from "@/components/unavailability-form";
import { MyClassesGrid } from "@/components/my-classes-grid";
import { CoachPrevWeekBanner } from "@/components/coach-prev-week-banner";
import { submitClassReports } from "@/lib/actions/submissions";
import { coachLogout } from "@/lib/actions/auth";
import { loadCoachWeekData } from "@/lib/coach-upload-data";
import { COACH_COOKIE, verifyCoachSessionToken } from "@/lib/session";

// Every class's status select on the grid shares this one form (via the
// `form=` attribute) so "Save all changes" commits every pick in one submit
// instead of the coach having to save each class individually.
const BULK_FORM_ID = "my-classes-bulk-form";

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

  const requested = (weekParam && parseDateOnly(weekParam)) || toDateOnly(new Date());
  const weekStart = startOfWeekMonday(requested);
  const weekEnd = addDays(weekStart, 7);
  const prevWeek = formatDateISO(addDays(weekStart, -7));
  const nextWeek = formatDateISO(addDays(weekStart, 7));

  const coaches = await prisma.coach.findMany({
    where: { archived: false },
    orderBy: { name: "asc" },
  });

  const [{ instances, mySubmissionByInstance, myPrivateClasses, locked }, myUnavailability] =
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
            Crossfit Box — My Classes
          </span>
          <form action={coachLogout} className="ml-auto">
            <button type="submit" className="text-sm text-neutral-400 hover:text-white">
              Log out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 text-neutral-300">
        <h1 className="mb-1 text-lg font-semibold text-white">
          {coach.name}&apos;s classes
        </h1>
        <p className="mb-4 text-sm text-neutral-500">
          You&apos;ll see your classes for the week below, plus any that are
          still unassigned — mark one you did (or missed). Once a class is
          saved as Missed, you can note who covered it right there. If you
          report a class more than once, whoever reports most recently is
          what counts.
        </p>

        <div className="mb-6 flex items-center gap-3 text-sm">
          <Link
            href={`/upload?week=${prevWeek}`}
            className="text-neutral-400 hover:text-white"
          >
            ← Prev
          </Link>
          <span className="text-neutral-500">
            Week of {formatDayLabel(weekStart)} – {formatDayLabel(addDays(weekStart, 6))}
          </span>
          <Link
            href={`/upload?week=${nextWeek}`}
            className="text-neutral-400 hover:text-white"
          >
            Next →
          </Link>
        </div>

        <CoachPrevWeekBanner coachId={coach.id} />

        <UnavailabilityForm coachId={coach.id} entries={myUnavailability} />

        {locked && (
          <p className="mb-6 rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-300">
            This week&apos;s planning has been validated by the admin — reporting is
            closed. Contact the admin if something needs to change.
          </p>
        )}

        <PrivateClassForm
          coachId={coach.id}
          weekStart={weekStart}
          entries={myPrivateClasses}
          locked={locked}
        />

        {instances.length > 0 && (
          <>
            <form id={BULK_FORM_ID} action={submitClassReports} />
            <div className="mb-3 flex justify-end">
              <button
                type="submit"
                form={BULK_FORM_ID}
                disabled={locked}
                className="rounded-md bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Save all changes
              </button>
            </div>
          </>
        )}

        {instances.length > 0 ? (
          <MyClassesGrid
            weekStart={weekStart}
            instances={instances}
            coachId={coach.id}
            coaches={coaches}
            mySubmissionByInstance={mySubmissionByInstance}
            bulkFormId={BULK_FORM_ID}
            locked={locked}
          />
        ) : (
          <p className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500">
            No classes this week.
          </p>
        )}
      </main>
    </div>
  );
}
