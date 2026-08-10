import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  startOfWeekMonday,
  addDays,
  formatDateISO,
  formatDayLabel,
  parseDateOnly,
  toDateOnly,
} from "@/lib/dates";
import { CoachWeekPicker } from "@/components/coach-week-picker";
import { PrivateClassForm } from "@/components/private-class-form";
import { MyClassesGrid } from "@/components/my-classes-grid";
import { CoachPrevWeekBanner } from "@/components/coach-prev-week-banner";
import { submitClassReports } from "@/lib/actions/submissions";
import { isWeekValidated } from "@/lib/planning-lock";

// Every class's status select on the grid shares this one form (via the
// `form=` attribute) so "Save all changes" commits every pick in one submit
// instead of the coach having to save each class individually.
const BULK_FORM_ID = "my-classes-bulk-form";

export default async function UploadPage({
  searchParams,
}: PageProps<"/upload">) {
  const params = await searchParams;
  const weekParam = typeof params?.week === "string" ? params.week : undefined;
  const coachId = typeof params?.coachId === "string" ? params.coachId : "";

  const requested = (weekParam && parseDateOnly(weekParam)) || toDateOnly(new Date());
  const weekStart = startOfWeekMonday(requested);
  const weekEnd = addDays(weekStart, 7);
  const weekStartStr = formatDateISO(weekStart);
  const prevWeek = formatDateISO(addDays(weekStart, -7));
  const nextWeek = formatDateISO(addDays(weekStart, 7));

  const coaches = await prisma.coach.findMany({ orderBy: { name: "asc" } });
  const selectedCoach = coaches.find((c) => c.id === coachId);
  const locked = await isWeekValidated(weekStart);

  const instances = selectedCoach
    ? await prisma.classInstance.findMany({
        where: { date: { gte: weekStart, lt: weekEnd } },
        include: { coach: true },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      })
    : [];

  const mySubmissions = selectedCoach
    ? await prisma.classSubmission.findMany({
        where: {
          coachId: selectedCoach.id,
          classInstanceId: { in: instances.map((i) => i.id) },
        },
      })
    : [];
  const mySubmissionByInstance = new Map(mySubmissions.map((s) => [s.classInstanceId, s]));

  const myPrivateClasses = selectedCoach
    ? await prisma.classInstance.findMany({
        where: {
          coachId: selectedCoach.id,
          isPrivate: true,
          date: { gte: weekStart, lt: weekEnd },
        },
        select: { id: true, date: true, startTime: true, endTime: true },
      })
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950">
      <header className="border-b border-neutral-800 bg-neutral-950">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <span className="text-sm font-semibold text-white">
            Crossfit Box — My Classes
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 text-neutral-300">
        <h1 className="mb-1 text-lg font-semibold text-white">My classes</h1>
        <p className="mb-4 text-sm text-neutral-500">
          Pick your name and week — you&apos;ll see the whole week&apos;s
          planning. Mark any class you did (or missed); it doesn&apos;t have
          to be one assigned to you. Once a class is saved as Missed, you can
          note who covered it right there. If more than one coach reports
          doing the same class, whoever reports most recently is what counts.
        </p>

        <div className="mb-6 flex items-center gap-3 text-sm">
          <Link
            href={`/upload?week=${prevWeek}&coachId=${coachId}`}
            className="text-neutral-400 hover:text-white"
          >
            ← Prev
          </Link>
          <span className="text-neutral-500">
            Week of {formatDayLabel(weekStart)} – {formatDayLabel(addDays(weekStart, 6))}
          </span>
          <Link
            href={`/upload?week=${nextWeek}&coachId=${coachId}`}
            className="text-neutral-400 hover:text-white"
          >
            Next →
          </Link>
        </div>

        <div className="mb-6 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <CoachWeekPicker
            week={weekStartStr}
            coachId={coachId}
            coaches={coaches}
          />
        </div>

        {selectedCoach && <CoachPrevWeekBanner coachId={selectedCoach.id} />}

        {selectedCoach && locked && (
          <p className="mb-6 rounded-md border border-amber-900 bg-amber-950 px-3 py-2 text-sm text-amber-300">
            This week&apos;s planning has been validated by the admin — reporting is
            closed. Contact the admin if something needs to change.
          </p>
        )}

        {selectedCoach && (
          <PrivateClassForm
            coachId={selectedCoach.id}
            weekStart={weekStart}
            entries={myPrivateClasses}
            locked={locked}
          />
        )}

        {selectedCoach && instances.length > 0 && (
          <>
            <form id={BULK_FORM_ID} action={submitClassReports} />
            <input type="hidden" name="coachId" value={selectedCoach.id} form={BULK_FORM_ID} />
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

        {selectedCoach && (
          instances.length > 0 ? (
            <MyClassesGrid
              weekStart={weekStart}
              instances={instances}
              coachId={selectedCoach.id}
              coaches={coaches}
              mySubmissionByInstance={mySubmissionByInstance}
              bulkFormId={BULK_FORM_ID}
              locked={locked}
            />
          ) : (
            <p className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-6 text-center text-sm text-neutral-500">
              No classes this week.
            </p>
          )
        )}
      </main>
    </div>
  );
}
