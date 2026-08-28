"use client";

import { markPrivateBalancePaid } from "@/lib/actions/coaches";

export function MarkPrivatePaidButton({
  coachId,
  balance,
}: {
  coachId: string;
  balance: number;
}) {
  return (
    <form
      action={markPrivateBalancePaid}
      onSubmit={(e) => {
        if (!window.confirm(`Marquer les ${balance}€ de cours privés comme payés à la box ?`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={coachId} />
      <input type="hidden" name="amount" value={balance} />
      <button
        type="submit"
        disabled={balance === 0}
        className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-400 hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-700 disabled:hover:text-neutral-400"
      >
        Marquer payé
      </button>
    </form>
  );
}
