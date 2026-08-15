"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import {
  ADMIN_COOKIE,
  COACH_COOKIE,
  createAdminSessionToken,
  createCoachSessionToken,
} from "@/lib/session";

export type AuthActionState = { error: string | null };

// Mirrors SESSION_MAX_AGE_MS in lib/session.ts — the cookie's own expiry and
// the signed token's embedded expiry should agree.
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days, in seconds
};

// Constant-time string comparison (via digest, so unequal-length inputs
// don't throw or short-circuit) — the admin password is a single shared
// secret, worth the same care as a per-user password.
function safeEqual(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

export async function adminLogin(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !password || !safeEqual(password, expected)) {
    return { error: "Incorrect password" };
  }

  (await cookies()).set(ADMIN_COOKIE, await createAdminSessionToken(), SESSION_COOKIE_OPTIONS);
  redirect("/admin");
}

export async function adminLogout() {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin-login");
}

export async function coachLogin(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!name || !password) return { error: "Enter your name and password" };

  const coach = await prisma.coach.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  // Same generic error whether the name doesn't exist, is archived, has no
  // password set yet, or the password is wrong — never reveal which.
  if (
    !coach ||
    coach.archived ||
    !coach.passwordHash ||
    !verifyPassword(password, coach.passwordHash)
  ) {
    return { error: "Incorrect name or password" };
  }

  (await cookies()).set(
    COACH_COOKIE,
    await createCoachSessionToken(coach.id),
    SESSION_COOKIE_OPTIONS
  );
  redirect("/upload");
}

export async function coachLogout() {
  (await cookies()).delete(COACH_COOKIE);
  redirect("/login");
}
