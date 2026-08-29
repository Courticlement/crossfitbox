"use client";

import { useEffect, useState } from "react";

const MESSAGE =
  "Vous avez des modifications non enregistrées sur les modèles de cours. Enregistrez-les avant de quitter cette page.";

// Watches every field wired to `formId` via the `form=` attribute (see
// templates/page.tsx) and warns before the user navigates away — via a
// link click, a tab close/refresh, or a browser back/forward — while
// there are unsaved edits.
export function UnsavedChangesGuard({ formId }: { formId: string }) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const isTrackedField = (target: EventTarget | null) =>
      target instanceof HTMLElement && target.getAttribute("form") === formId;

    function handleFieldChange(e: Event) {
      if (isTrackedField(e.target)) setDirty(true);
    }

    function handleSubmit(e: Event) {
      const form = e.target as HTMLFormElement;
      if (form.id === formId) setDirty(false);
    }

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }

    function handleClickCapture(e: MouseEvent) {
      if (!dirty) return;
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.getAttribute("target") === "_blank") {
        return;
      }

      const proceed = window.confirm(MESSAGE);
      if (!proceed) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      setDirty(false);
    }

    document.addEventListener("input", handleFieldChange, true);
    document.addEventListener("change", handleFieldChange, true);
    document.addEventListener("submit", handleSubmit, true);
    document.addEventListener("click", handleClickCapture, true);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("input", handleFieldChange, true);
      document.removeEventListener("change", handleFieldChange, true);
      document.removeEventListener("submit", handleSubmit, true);
      document.removeEventListener("click", handleClickCapture, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirty, formId]);

  if (!dirty) return null;

  return (
    <div className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-3 rounded-md border border-amber-700/50 bg-amber-950/60 px-4 py-2 text-sm text-amber-200">
      <span>Modifications non enregistrées sur les modèles de cours.</span>
      <button
        type="submit"
        form={formId}
        className="rounded bg-amber-500 px-2 py-1 text-xs font-medium whitespace-nowrap text-neutral-950 hover:bg-amber-400"
      >
        Enregistrer maintenant
      </button>
    </div>
  );
}
