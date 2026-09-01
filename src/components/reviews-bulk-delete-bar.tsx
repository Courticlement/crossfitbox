"use client";

import { useEffect, useState } from "react";
import { deleteClassReviews } from "@/lib/actions/reviews";

// The form itself lives here, at the top of the list — each row's checkbox
// (rendered separately, see the reviews page) points at it via the HTML
// `form` attribute instead of being nested inside it, so a row can also
// hold its own independent single-delete form (see DeleteReviewButton)
// without ending up with a <form> nested inside a <form>.
export const REVIEWS_BULK_DELETE_FORM_ID = "reviews-bulk-delete";

export function ReviewsBulkDeleteBar() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const recompute = () => {
      setCount(
        document.querySelectorAll(
          `input[form="${REVIEWS_BULK_DELETE_FORM_ID}"]:checked`
        ).length
      );
    };
    recompute();
    document.addEventListener("change", recompute);
    return () => document.removeEventListener("change", recompute);
  }, []);

  return (
    <form
      id={REVIEWS_BULK_DELETE_FORM_ID}
      action={deleteClassReviews}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Supprimer les ${count} review${count > 1 ? "s" : ""} sélectionnée${count > 1 ? "s" : ""} ? Cette action est irréversible.`
          )
        ) {
          e.preventDefault();
        }
      }}
      className={`mb-3 flex items-center justify-between rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-2 ${
        count === 0 ? "hidden" : ""
      }`}
    >
      <span className="text-sm text-red-300">
        {count} review{count > 1 ? "s" : ""} sélectionnée{count > 1 ? "s" : ""}
      </span>
      <button
        type="submit"
        className="rounded-md border border-red-800 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/40"
      >
        Supprimer la sélection
      </button>
    </form>
  );
}
