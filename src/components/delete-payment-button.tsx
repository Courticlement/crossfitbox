"use client";

import { deletePrivatePayment } from "@/lib/actions/coaches";

export function DeletePaymentButton({
  paymentId,
  coachName,
  amount,
}: {
  paymentId: string;
  coachName: string;
  amount: number;
}) {
  return (
    <form
      action={deletePrivatePayment}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Supprimer ce paiement de ${amount}€ pour ${coachName} ? S'il s'agit de son dernier paiement, son solde redeviendra dû.`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={paymentId} />
      <button
        type="submit"
        className="rounded-md border border-neutral-800 px-2 py-1 text-xs text-red-400 hover:border-red-900 hover:text-red-300"
      >
        Supprimer
      </button>
    </form>
  );
}
