// Display-only French labels for ClassInstance/ClassSubmission.status — the
// underlying values ("PLANNED" | "DONE" | "MISSED" | "CANCELLED") stay in
// English since they're compared against throughout the app's logic.
export const STATUS_LABEL_FR: Record<string, string> = {
  PLANNED: "Prévu",
  DONE: "Fait",
  MISSED: "Manqué",
  CANCELLED: "Annulé",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL_FR[status] ?? status;
}
