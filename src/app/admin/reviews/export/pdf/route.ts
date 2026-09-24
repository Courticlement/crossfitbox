import { tenantPrisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/auth-context";
import { renderReviewsPdf } from "@/lib/reviews-pdf";
import { formatDateISO } from "@/lib/dates";

export async function GET(request: Request) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const url = new URL(request.url);
  const coachIds = url.searchParams.getAll("coachId");
  if (coachIds.length === 0) {
    return Response.redirect(new URL("/admin/reviews/export?error=1", request.url), 302);
  }

  const reviews = await prisma.classReview.findMany({
    where: { subjectCoachId: { in: coachIds } },
    include: { classInstance: true, subjectCoach: true },
    orderBy: [{ subjectCoach: { name: "asc" } }, { classInstance: { date: "asc" } }],
  });

  const pdf = await renderReviewsPdf(reviews);
  const filename = `reviews-${formatDateISO(new Date())}.pdf`;

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
