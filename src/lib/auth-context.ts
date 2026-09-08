import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  ADMIN_COOKIE,
  COACH_COOKIE,
  verifyAdminSessionToken,
  verifyCoachSessionToken,
  type AdminSession,
  type CoachSession,
} from "@/lib/session";

// A session's signature and expiry can be perfectly valid while the
// organizationId it names no longer exists (a stale cookie from a
// since-removed or differently-seeded box, most plausibly left over from an
// earlier local install pointed at a different database) — the token
// itself can't catch this, since it's just checking its own signature (see
// lib/session.ts). Every path that's about to trust a session's
// organizationId to pick a tenant Postgres schema (see tenantPrisma) checks
// this first, so a stale session is treated as no session at all instead of
// failing deep inside a query with a raw "table does not exist" error.
async function organizationExists(organizationId: string): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  return org !== null;
}

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
  const session = await verifyCoachSessionToken(token);
  if (!session) return null;
  if (!(await organizationExists(session.organizationId))) return null;
  return session;
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
// Redirects to the admin login for an unauthenticated caller, a
// PLATFORM_SUPERADMIN (organizationId null — they operate outside every
// box, see requirePlatformSuperadmin in lib/actions/organizations.ts
// instead), or a session naming an organization that no longer exists (see
// organizationExists above) — proxy.ts already redirects the ordinary
// missing-cookie case before a page even renders, so in practice this is
// mostly a safety net for that last case, and for a Server Action called
// after the cookie's gone stale mid-session. redirect() is safe to call
// from a shared helper like this one: Next treats it the same regardless of
// call depth, in Server Components, Server Actions, and Route Handlers
// alike. Never trust an organizationId read from client-supplied FormData
// instead of this — a server action is a plain POST endpoint, reachable
// without going through proxy.ts's route-level gate.
export async function requireOrgAdmin(): Promise<OrgAdminSession> {
  const session = await requireAdmin();
  if (!session || !session.organizationId || !(await organizationExists(session.organizationId))) {
    redirect("/admin-login");
  }
  return { adminId: session.adminId, role: session.role, organizationId: session.organizationId };
}
