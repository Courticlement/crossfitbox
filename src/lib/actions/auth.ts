"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, tenantPrisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  ADMIN_COOKIE,
  COACH_COOKIE,
  IMPERSONATOR_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createAdminSessionToken,
  createCoachSessionToken,
} from "@/lib/session";

export type AuthActionState = { error: string | null };

export async function adminLogin(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email ou mot de passe incorrect" };

  const admin = await prisma.admin.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
  });
  // Same generic error whether the email doesn't exist, is archived, or the
  // password is wrong — never reveal which (mirrors coachLogin below).
  if (!admin || admin.archived || !verifyPassword(password, admin.passwordHash)) {
    return { error: "Email ou mot de passe incorrect" };
  }

  (await cookies()).set(
    ADMIN_COOKIE,
    await createAdminSessionToken(admin.id, admin.role, admin.organizationId),
    SESSION_COOKIE_OPTIONS
  );
  // A PLATFORM_SUPERADMIN (organizationId null) belongs to no box — send
  // them straight to the Organizations screen instead of a box dashboard.
  redirect(admin.organizationId ? "/admin" : "/superadmin");
}

export async function adminLogout() {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
  // Logging out while impersonating (instead of using stopImpersonating)
  // shouldn't leave the platform-superadmin's stashed token sitting in a
  // cookie indefinitely.
  jar.delete(IMPERSONATOR_COOKIE);
  redirect("/admin-login");
}

export async function coachLogin(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!organizationId || !name || !password) {
    return { error: "Choisissez votre box, puis entrez votre nom et votre mot de passe" };
  }

  // Coach.name is only unique within an organization (two boxes can each
  // have a coach with the same name) — organizationId (picked from the
  // form's box selector) is required to find the right one, and to know
  // which organization's own Postgres schema even has a Coach table to
  // query (see tenantPrisma in lib/prisma.ts) — Coach doesn't live in the
  // shared control-plane schema the way Organization/Admin do.
  const org = await prisma.organization.findUnique({ where: { id: organizationId } });
  if (!org) return { error: "Nom ou mot de passe incorrect" };

  const coach = await tenantPrisma(organizationId).coach.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  // Same generic error whether the box/name doesn't match, is archived, has
  // no password set yet, or the password is wrong — never reveal which.
  if (
    !coach ||
    coach.archived ||
    !coach.passwordHash ||
    !verifyPassword(password, coach.passwordHash)
  ) {
    return { error: "Nom ou mot de passe incorrect" };
  }

  (await cookies()).set(
    COACH_COOKIE,
    await createCoachSessionToken(coach.id, organizationId),
    SESSION_COOKIE_OPTIONS
  );
  redirect("/upload");
}

export async function coachLogout() {
  (await cookies()).delete(COACH_COOKIE);
  redirect("/login");
}
