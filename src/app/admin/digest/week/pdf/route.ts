import { formatDateISO, parseDateOnly, startOfWeekMonday, toDateOnly } from "@/lib/dates";
import { weeklyDigestRows } from "@/lib/digest-rows";
import { renderDigestPdf } from "@/lib/digest-pdf";
import { requireOrgAdmin } from "@/lib/auth-context";

export async function GET(request: Request) {
  const { organizationId } = await requireOrgAdmin();

  const url = new URL(request.url);
  const requested = parseDateOnly(url.searchParams.get("week") ?? "") || toDateOnly(new Date());
  const weekStart = startOfWeekMonday(requested);

  const { rows, periodLabel } = await weeklyDigestRows(organizationId, weekStart);
  const pdf = await renderDigestPdf(rows, "Récapitulatif des coachs", periodLabel);
  const filename = `recapitulatif-hebdomadaire-${formatDateISO(weekStart)}.pdf`;

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
