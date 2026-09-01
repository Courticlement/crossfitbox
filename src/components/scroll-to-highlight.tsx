"use client";

import { useEffect } from "react";

// Brings a highlighted class instance (see WeekGrid's highlightInstanceId)
// into view on load — the target can land anywhere in the week, well below
// the fold, so the ring alone isn't enough to actually find it.
export function ScrollToHighlight({ instanceId }: { instanceId: string }) {
  useEffect(() => {
    // Both WeekGrid (desktop) and DayAgenda (mobile) render the highlighted
    // instance, each under its own id (see DayAgenda) — only one is ever
    // actually visible at a given viewport width, so try both.
    document
      .getElementById(`class-instance-${instanceId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    document
      .getElementById(`class-instance-mobile-${instanceId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [instanceId]);

  return null;
}
