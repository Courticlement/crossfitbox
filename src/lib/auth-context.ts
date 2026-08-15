import { cookies } from "next/headers";
import { COACH_COOKIE, verifyCoachSessionToken } from "@/lib/session";

// The authoritative coach identity for the current request. Server actions
// that mutate a specific coach's own data must use this instead of trusting
// a client-supplied coachId in FormData — a hidden input is just a UI
// convenience and anyone can edit it before submitting.
export async function requireCoachId(): Promise<string | null> {
  const token = (await cookies()).get(COACH_COOKIE)?.value;
  return verifyCoachSessionToken(token);
}
