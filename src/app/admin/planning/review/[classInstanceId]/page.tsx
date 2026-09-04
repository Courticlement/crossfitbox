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

  const instance = await tenantPrisma(organizationId).classInstance.findFirst({
    where: { id: classInstanceId },
    include: { coach: true, review: true },
  });

  const backHref = `/admin/planning${week ? `?week=${week}` : ""}`;
  if (!instance) redirect(backHref);
  // Already reviewed — this is a one-review-per-class feature, so send the
  // admin straight to the existing review instead of letting them start a
  // second one.
  if (instance.review) redirect(`/admin/reviews/${instance.review.id}`);

  return (
    <ReviewWizard
      classInfo={{
        id: instance.id,
        label: instance.label,
        time: `${instance.startTime}–${instance.endTime}`,
        dateLabel: formatDayLabel(instance.date),
        coachName: instance.coach?.name ?? "Non assigné",
      }}
      backHref={backHref}
    />
  );
}
