import { prisma } from "@/lib/prisma";
import { addDays, parseDateOnly } from "@/lib/dates";
import { PaymentsFilters } from "@/components/payments-filters";
import { DeletePaymentButton } from "@/components/delete-payment-button";
import { PrevWeekBanner } from "@/components/prev-week-banner";
import { PrivatePaymentAlert } from "@/components/private-payment-alert";

// See DataPage (admin/data) for why this is forced dynamic rather than
// statically prerendered — same reasoning: payment history changes whenever
// a coach's balance is marked paid, and a stale prerender would hide that.
export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: PageProps<"/admin/payments">) {
  const params = await searchParams;
  const fromParam = typeof params?.from === "string" ? params.from : undefined;
  const toParam = typeof params?.to === "string" ? params.to : undefined;
  const coachIdFilter = typeof params?.coachId === "string" ? params.coachId : "";

  // Unlike the Data page's 30-day default, this page's whole purpose is
  // looking back over the full history — no date bound unless the admin
  // narrows it.
  const from = fromParam ? parseDateOnly(fromParam) : null;
  const to = toParam ? parseDateOnly(toParam) : null;
  const toExclusive = to ? addDays(to, 1) : null;

  const [coaches, payments] = await Promise.all([
    prisma.coach.findMany({ orderBy: { name: "asc" } }),
    prisma.privatePayment.findMany({
      where: {
        ...(from ? { paidAt: { gte: from } } : {}),
        ...(toExclusive ? { paidAt: { lt: toExclusive } } : {}),
        ...(coachIdFilter ? { coachId: coachIdFilter } : {}),
      },
      include: { coach: true },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="text-neutral-300">
      <h1 className="mb-1 text-lg font-semibold text-white">Paiements</h1>
      <PrevWeekBanner />
      <PrivatePaymentAlert />
      <p className="mb-4 text-sm text-neutral-500">
        Historique des règlements de cours privés — chaque ligne est créée
        automatiquement quand un coach est marqué payé depuis la page{" "}
        <span className="text-neutral-400">Coachs</span>, et reste ici comme
        preuve même une fois son solde remis à 0€.
      </p>

      <PaymentsFilters
        from={fromParam ?? ""}
        to={toParam ?? ""}
        coachId={coachIdFilter}
        coaches={coaches}
      />

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-white">
          {payments.length} paiement{payments.length !== 1 ? "s" : ""}
        </h2>
        <span className="text-sm text-neutral-400">
          Total : <span className="font-medium text-white">{total}€</span>
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left text-neutral-400">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Coach</th>
              <th className="px-4 py-2 text-right font-medium">Montant réglé</th>
              <th className="px-4 py-2 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-t border-neutral-800">
                <td className="px-4 py-2 whitespace-nowrap">
                  {payment.paidAt.toLocaleString("fr-FR", { timeZone: "UTC" })}
                </td>
                <td className="px-4 py-2 text-white">{payment.coach.name}</td>
                <td className="px-4 py-2 text-right text-white">{payment.amount}€</td>
                <td className="px-4 py-2 text-right">
                  <DeletePaymentButton
                    paymentId={payment.id}
                    coachName={payment.coach.name}
                    amount={payment.amount}
                  />
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-neutral-500">
                  Aucun paiement enregistré{fromParam || toParam || coachIdFilter ? " sur cette période" : ""}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
