// Turns the reason/detail a failed digest send redirects with (see
// digestErrorParams in lib/actions/digest.ts) into the sentence shown on
// the dashboard — same mapping for the week and month views.
export function digestErrorMessage(reason: string | undefined, detail: string | undefined): string {
  if (reason === "no_recipients") {
    return "Aucun admin ou superadmin n'a de compte pour cette box.";
  }
  if (reason === "no_api_key") {
    return "RESEND_API_KEY n'est pas configuré dans .env.";
  }
  if (reason === "send_failed") {
    return detail
      ? `Le service d'e-mail a refusé l'envoi : ${detail}`
      : "Le service d'e-mail a refusé l'envoi.";
  }
  return "Impossible d'envoyer le récapitulatif.";
}
