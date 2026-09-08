import { formatMonthISO, parseMonthOnly, startOfMonth, toDateOnly } from "@/lib/dates";
import { monthlyDigestRows } from "@/lib/digest-rows";
import { renderDigestPdf } from "@/lib/digest-pdf";
import { requireOrgAdmin } from "@/lib/auth-context";

export async function GET(request: Request) {
  const { organizationId } = await requireOrgAdmin();

  const url = new URL(request.url);
  const requested = parseMonthOnly(url.searchParams.get("month") ?? "") || toDateOnly(new Date());
  const monthStart = startOfMonth(requested);

  const { rows, periodLabel } = await monthlyDigestRows(organizationId, monthStart);
  const pdf = await renderDigestPdf(rows, "Récapitulatif des coachs", periodLabel);
  const filename = `recapitulatif-mensuel-${formatMonthISO(monthStart)}.pdf`;

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
