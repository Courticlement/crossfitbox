import Link from "next/link";
import { notFound } from "next/navigation";
import { tenantPrisma } from "@/lib/prisma";
import { formatDayLabel } from "@/lib/dates";
import { ReviewRecap } from "@/components/review-recap";
import { DeleteReviewButton } from "@/components/delete-review-button";
import { PILLARS, PILLAR_COLUMN, type PillarKey, type PillarRating } from "@/lib/review-constants";
import { requireOrgAdmin } from "@/lib/auth-context";

export default async function ReviewDetailPage({
  params,
  searchParams,
}: PageProps<"/admin/reviews/[id]">) {
  const { organizationId } = await requireOrgAdmin();
  const { id } = await params;
  const search = await searchParams;
  const justCreated = search?.created === "1";

  const review = await tenantPrisma(organizationId).classReview.findFirst({
    where: { id },
    include: { classInstance: { include: { coach: true } } },
  });
  if (!review) notFound();

  const inst = review.classInstance;
  const pillars = Object.fromEntries(
    PILLARS.map((p) => [p.key, review[PILLAR_COLUMN[p.key] as keyof typeof review] as PillarRating])
  ) as Record<PillarKey, PillarRating>;

  return (
    <div className="mx-auto max-w-2xl text-neutral-300">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin/reviews" className="text-sm text-neutral-500 hover:text-white">
          ‹ Retour à l&apos;historique
        </Link>
        <DeleteReviewButton
          reviewId={review.id}
          label={`de ${inst.coach?.name ?? "ce cours"} — ${inst.label}`}
          redirectTo="/admin/reviews"
        />
      </div>

      {justCreated && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-800 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
          ✓ Review enregistrée pour {inst.coach?.name ?? "ce cours"}.
        </div>
      )}

      <div className="mb-6 flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3">
        <span className="text-[15px] font-bold text-white">
          {inst.label}{" "}
          <span className="font-normal text-neutral-500">— {inst.coach?.name ?? "Non assigné"}</span>
        </span>
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
        pastille={review.pastille}
      />
    </div>
  );
}
