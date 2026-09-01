"use client";

import { deleteClassReviews } from "@/lib/actions/reviews";

// A standalone one-item form (not nested inside the row's Link or the
// bulk-select form — see ReviewsBulkDeleteBar) so a single delete never
// interferes with whatever is currently checked for a bulk delete.
export function DeleteReviewButton({
  reviewId,
  label,
  redirectTo,
}: {
  reviewId: string;
  label: string;
  redirectTo?: string;
}) {
  return (
    <form
      action={deleteClassReviews}
      onSubmit={(e) => {
        if (!window.confirm(`Supprimer la review ${label} ? Cette action est irréversible.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="ids" value={reviewId} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
      <button
        type="submit"
        title="Supprimer cette review"
        aria-label="Supprimer cette review"
        className="rounded-md p-1 text-neutral-600 hover:text-red-400"
      >
        🗑
      </button>
    </form>
  );
}
