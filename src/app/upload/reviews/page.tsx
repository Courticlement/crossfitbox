import { redirect } from "next/navigation";
import { tenantPrisma } from "@/lib/prisma";
import { formatDayLabel } from "@/lib/dates";
import { ReviewRecap } from "@/components/review-recap";
import { PILLARS, PILLAR_COLUMN, type PillarKey, type PillarRating } from "@/lib/review-constants";
import { requireCoachSession } from "@/lib/auth-context";

// The coach's own history of reviews written about them — deliberately
// missing the "Pastille de séance" section ReviewRecap otherwise renders:
// that overall grade is the head coach's own holistic call, not something
// handed back to the coach as a score (same reasoning as MyFocusCard
// leaving the pastille off the standing-focus card). Everything else —
// every segment's verbatim notes, all six pillars, and the feedback text —
// is shown in full.
export default async function MyReviewsPage() {
  const session = await requireCoachSession();
  if (!session) redirect("/login");
  const { coachId, organizationId } = session;
  const prisma = tenantPrisma(organizationId);

  const coach = await prisma.coach.findUnique({ where: { id: coachId } });
  if (!coach || coach.archived) redirect("/login");

  const reviews = await prisma.classReview.findMany({
    where: { subjectCoachId: coachId },
    include: { classInstance: true },
    orderBy: { classInstance: { date: "desc" } },
  });

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 text-neutral-300">
      <h1 className="mb-1 text-lg font-semibold text-white">Mes reviews</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Toutes les observations faites sur vos cours — la pastille finale
        reste réservée au suivi de l&apos;admin, elle n&apos;apparaît pas
        ici.
      </p>

      {reviews.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-800 p-10 text-center text-sm text-neutral-500">
          Aucune review pour le moment.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((review) => {
            const inst = review.classInstance;
            const pillars = Object.fromEntries(
              PILLARS.map((p) => [p.key, review[PILLAR_COLUMN[p.key] as keyof typeof review] as PillarRating])
            ) as Record<PillarKey, PillarRating>;

            return (
              <div key={review.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-5">
                <div className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-4">
                  <span className="text-[15px] font-bold text-white">{inst.label}</span>
                  <span className="text-right font-mono text-xs text-neutral-500">
                    {formatDayLabel(inst.date)}
                    <br />
                    {inst.startTime}–{inst.endTime}
                  </span>
                </div>

                <ReviewRecap
                  segments={{
                    briefing: review.briefingNotes,
                    generalWu: review.generalWuNotes,
                    specificWu: review.specificWuNotes,
                    skillWod: review.skillWodNotes,
                    coolDown: review.coolDownNotes,
                  }}
                  pillars={pillars}
                  identifiedText={review.identifiedText}
                  focusText={review.focusText}
                />
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
