import Link from "next/link";
import { redirect } from "next/navigation";
import { tenantPrisma } from "@/lib/prisma";
import { formatDayLabel } from "@/lib/dates";
import { ReviewWizard } from "@/components/review-wizard";
import { requireOrgAdmin } from "@/lib/auth-context";

export default async function NewClassReviewPage({
  params,
  searchParams,
}: PageProps<"/admin/planning/review/[classInstanceId]">) {
  const { organizationId } = await requireOrgAdmin();
  const { classInstanceId } = await params;
  const search = await searchParams;
  const week = typeof search?.week === "string" ? search.week : "";
  const subjectParam = typeof search?.subject === "string" ? search.subject : "";

  const instance = await tenantPrisma(organizationId).classInstance.findFirst({
    where: { id: classInstanceId },
    include: {
      coach: true,
      assistants: { include: { coach: true }, orderBy: { createdAt: "asc" } },
      reviews: { select: { id: true, subjectCoachId: true } },
    },
  });

  const backHref = `/admin/planning${week ? `?week=${week}` : ""}`;
  if (!instance) redirect(backHref);

  // Everyone this class could plausibly be reviewed about — the coach
  // first (if assigned), then each assistant in the order they were added.
  const candidates = [
    ...(instance.coach ? [{ id: instance.coach.id, name: instance.coach.name, role: "coach" as const }] : []),
    ...instance.assistants.map((a) => ({ id: a.coach.id, name: a.coach.name, role: "assistant" as const })),
  ];
  const reviewedIds = new Set(instance.reviews.map((r) => r.subjectCoachId));
  const pending = candidates.filter((c) => !reviewedIds.has(c.id));

  // Nobody left to review (already fully reviewed, or nobody's even
  // assigned) — nothing productive to do here.
  if (pending.length === 0) {
    const anyReview = instance.reviews[0];
    redirect(anyReview ? `/admin/reviews/${anyReview.id}` : backHref);
  }

  const subject =
    pending.find((c) => c.id === subjectParam) ?? (pending.length === 1 ? pending[0] : null);

  // More than one person still needs a review (e.g. coach + assistant, or
  // two assistants) and the caller didn't say which — ask, rather than
  // guessing who "Démarrer une review" meant.
  if (!subject) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-neutral-950 px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-white">Qui souhaitez-vous reviewer ?</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {instance.label} · {formatDayLabel(instance.date)} · {instance.startTime}–{instance.endTime}
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {pending.map((c) => (
            <Link
              key={c.id}
              href={`/admin/planning/review/${classInstanceId}?subject=${c.id}${week ? `&week=${week}` : ""}`}
              className="rounded-xl border border-neutral-700 px-4 py-3 text-sm font-medium text-white hover:border-neutral-500"
            >
              {c.name} <span className="text-neutral-500">— {c.role === "coach" ? "coach" : "assistant"}</span>
            </Link>
          ))}
        </div>
        <Link href={backHref} className="text-xs text-neutral-500 hover:text-white">
          Annuler
        </Link>
      </div>
    );
  }

  return (
    <ReviewWizard
      classInfo={{
        id: instance.id,
        label: instance.label,
        time: `${instance.startTime}–${instance.endTime}`,
        dateLabel: formatDayLabel(instance.date),
        subjectId: subject.id,
        subjectName: subject.name,
        subjectRole: subject.role,
      }}
      backHref={backHref}
    />
  );
}
