"use client";

import { useEffect } from "react";

// Brings a highlighted class instance (see WeekGrid's highlightInstanceId)
// into view on load — the target can land anywhere in the week, well below
// the fold, so the ring alone isn't enough to actually find it.
export function ScrollToHighlight({ instanceId }: { instanceId: string }) {
  useEffect(() => {
    document
      .getElementById(`class-instance-${instanceId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [instanceId]);

  return null;
}
