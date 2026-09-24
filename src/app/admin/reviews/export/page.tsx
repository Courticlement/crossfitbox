import Link from "next/link";
import { tenantPrisma } from "@/lib/prisma";
import { requireOrgAdmin } from "@/lib/auth-context";
import { ReviewExportCoachPicker } from "@/components/review-export-coach-picker";

export default async function ExportReviewsPage({
  searchParams,
}: PageProps<"/admin/reviews/export">) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);
  const search = await searchParams;

  const coaches = await prisma.coach.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, archived: true },
  });

  return (
    <div className="mx-auto max-w-xl text-neutral-300">
      <Link href="/admin/reviews" className="mb-4 inline-block text-sm text-neutral-500 hover:text-white">
        ‹ Retour à l&apos;historique
      </Link>
      <h1 className="mb-1 text-lg font-semibold text-white">Exporter les reviews en PDF</h1>
      <p className="mb-6 text-sm text-neutral-400">
        Choisissez les coachs à inclure dans l&apos;export — toutes leurs reviews (déroulé, piliers, feedback et
        pastille) seront dans le PDF.
      </p>

      {search?.error === "1" && (
        <p className="mb-4 rounded-md border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">
          Sélectionnez au moins un coach.
        </p>
      )}

      {coaches.length === 0 ? (
        <p className="text-sm text-neutral-500">Aucun coach.</p>
      ) : (
        <form method="get" action="/admin/reviews/export/pdf">
          <ReviewExportCoachPicker coaches={coaches} />
          <button
            type="submit"
            className="mt-6 w-full rounded-md bg-white px-3 py-2.5 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            Générer le PDF
          </button>
        </form>
      )}
    </div>
  );
}
