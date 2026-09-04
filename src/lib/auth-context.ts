import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  COACH_COOKIE,
  verifyAdminSessionToken,
  verifyCoachSessionToken,
  type AdminSession,
  type CoachSession,
} from "@/lib/session";

// The authoritative coach identity AND organization for the current
// request. Server actions that mutate a specific coach's own data must use
// this instead of trusting a client-supplied coachId in FormData — a
// hidden input is just a UI convenience and anyone can edit it before
// submitting. organizationId is needed just as much as coachId itself:
// Coach lives in that organization's own Postgres schema (see tenantPrisma
// in lib/prisma.ts), so there's no way to look the coach up at all without
// already knowing which schema to query.
export async function requireCoachSession(): Promise<CoachSession | null> {
  const token = (await cookies()).get(COACH_COOKIE)?.value;
  return verifyCoachSessionToken(token);
}

// The authoritative admin identity (and role) for the current request.
// Managing Admin accounts (lib/actions/admins.ts) is SUPERADMIN-only —
// proxy.ts already blocks a plain ADMIN from reaching /admin/admins, but
// server actions are called directly and must re-check for themselves.
export async function requireAdmin(): Promise<AdminSession | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export type OrgAdminSession = { adminId: string; role: string; organizationId: string };

// The authoritative admin identity AND organization for the current
// request, for every action/page scoped to one box (coaches, templates,
// planning, quotas, reviews, digest, rooms, and that box's own admins).
// Throws for an unauthenticated caller and for a PLATFORM_SUPERADMIN
// (organizationId null — they operate outside every box, see
// requirePlatformSuperadmin in lib/actions/organizations.ts instead).
// Never trust an organizationId read from client-supplied FormData instead
// of this — a server action is a plain POST endpoint, reachable without
// going through proxy.ts's route-level gate.
export async function requireOrgAdmin(): Promise<OrgAdminSession> {
  const session = await requireAdmin();
  if (!session || !session.organizationId) throw new Error("Forbidden");
  return { adminId: session.adminId, role: session.role, organizationId: session.organizationId };
}
