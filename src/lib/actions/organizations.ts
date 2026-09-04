"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, tenantPrisma, tenantSchemaName } from "@/lib/prisma";
import { tenantTableDdl, tenantTableForeignKeys } from "@/lib/tenant-schema";
import { Prisma } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/auth-context";
import {
  ADMIN_COOKIE,
  IMPERSONATOR_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from "@/lib/session";

// Platform-level actions — creating/listing Organizations (boxes) — are
// only reachable by a PLATFORM_SUPERADMIN (organizationId null). This is
// the platform-level counterpart to requireSuperadmin in admins.ts, which
// is scoped to managing one box's own admins instead.
async function requirePlatformSuperadmin(): Promise<string> {
  const session = await requireAdmin();
  if (!session || session.organizationId !== null || session.role !== "PLATFORM_SUPERADMIN") {
    throw new Error("Forbidden");
  }
  return session.adminId;
}

function genId(): string {
  return "c" + randomUUID().replace(/-/g, "");
}

// Creates a new box in one transaction: the Organization row itself (in the
// shared control-plane schema, alongside Admin — see prisma/schema.prisma's
// comment on Organization for why those two stay shared while everything
// else is per-organization), a brand-new Postgres schema holding its own
// copy of every operational table (Room, Coach, ClassTemplate, ...; see
// lib/tenant-schema.ts), its initial Room(s), and the box's own first Admin
// (its SUPERADMIN, able to invite further admins/coaches once they log in —
// see lib/actions/admins.ts). All of this runs as raw SQL over the
// control-plane connection inside one Postgres transaction — Postgres DDL
// is transactional, so a failure partway through (a name collision, a bad
// room name) rolls back the schema and everything in it along with the
// Organization/Admin rows, leaving nothing dangling. Mirrors createCoach's
// silent-no-op-on-collision convention for the organization name (a very
// plausible re-submit scenario), but lets an admin-email collision surface
// as a thrown error instead — silently failing to create a brand-new box's
// only login credential would leave it inaccessible with no visible cause.
export async function createOrganization(formData: FormData) {
  await requirePlatformSuperadmin();

  const name = String(formData.get("name") ?? "").trim();
  const roomNames = formData
    .getAll("roomName")
    .map((v) => String(v).trim())
    .filter(Boolean);
  const adminEmail = String(formData.get("adminEmail") ?? "").trim();
  const adminPassword = String(formData.get("adminPassword") ?? "");
  if (!name || roomNames.length === 0 || !adminEmail || adminPassword.length < 6) return;

  try {
    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({ data: { name } });
      const schema = tenantSchemaName(org.id);

      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      for (const stmt of tenantTableDdl(schema)) {
        await tx.$executeRawUnsafe(stmt);
      }
      for (const stmt of tenantTableForeignKeys(schema)) {
        await tx.$executeRawUnsafe(stmt);
      }
      for (const roomName of roomNames) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "${schema}"."Room" ("id", "organizationId", "name", "createdAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
          genId(),
          org.id,
          roomName
        );
      }

      await tx.admin.create({
        data: {
          email: adminEmail,
          passwordHash: hashPassword(adminPassword),
          role: "SUPERADMIN",
          organizationId: org.id,
        },
      });
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      (err.meta?.target as string[] | undefined)?.some((f) => f.includes("name"))
    ) {
      return; // organization name already taken — silent no-op
    }
    throw err;
  }

  revalidatePath("/superadmin");
}

function revalidateOrgPaths(organizationId: string) {
  revalidatePath("/superadmin");
  revalidatePath(`/superadmin/organizations/${organizationId}`);
}

export async function renameOrganization(formData: FormData) {
  await requirePlatformSuperadmin();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  try {
    await prisma.organization.update({ where: { id }, data: { name } });
  } catch (err) {
    // Either the id doesn't exist (P2025) or the new name collides with
    // another organization's (P2002) — either way, silent no-op, same
    // convention as createOrganization's name-collision handling above.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      (err.code === "P2002" || err.code === "P2025")
    ) {
      return;
    }
    throw err;
  }

  revalidateOrgPaths(id);
}

// Platform-level counterparts to lib/actions/rooms.ts's createRoom/
// renameRoom/archiveRoom/unarchiveRoom — those are gated by requireOrgAdmin
// (scoped to the caller's own box), which a PLATFORM_SUPERADMIN doesn't
// have since they belong to no box. These take organizationId explicitly
// from the form instead, trusted because the caller has already proven
// platform-superadmin status, which grants access to every box by design —
// and route through tenantPrisma since Room lives in that box's own
// Postgres schema, not the shared control-plane one.
export async function platformCreateRoom(formData: FormData) {
  await requirePlatformSuperadmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const shortLabel = String(formData.get("shortLabel") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!organizationId || !name) return;

  try {
    await tenantPrisma(organizationId).room.create({
      data: { organizationId, name, shortLabel, color },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
  revalidateOrgPaths(organizationId);
}

export async function platformRenameRoom(formData: FormData) {
  await requirePlatformSuperadmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const shortLabel = String(formData.get("shortLabel") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!organizationId || !id || !name) return;

  try {
    await tenantPrisma(organizationId).room.updateMany({
      where: { id },
      data: { name, shortLabel, color },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
  revalidateOrgPaths(organizationId);
}

export async function platformArchiveRoom(formData: FormData) {
  await requirePlatformSuperadmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!organizationId || !id) return;

  await tenantPrisma(organizationId).room.updateMany({ where: { id }, data: { archived: true } });
  revalidateOrgPaths(organizationId);
}

export async function platformUnarchiveRoom(formData: FormData) {
  await requirePlatformSuperadmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!organizationId || !id) return;

  await tenantPrisma(organizationId).room.updateMany({ where: { id }, data: { archived: false } });
  revalidateOrgPaths(organizationId);
}

// Platform-level counterpart to lib/actions/admins.ts's createAdmin — that
// one is scoped to a box's own SUPERADMIN adding admins within their own
// organization; this lets a PLATFORM_SUPERADMIN add an admin to any box
// directly from its /superadmin edit page (e.g. right after creating the
// box, or to add a second admin without impersonating first). Admin stays
// in the shared control-plane schema (see createOrganization's comment), so
// this uses the plain control-plane prisma client, not tenantPrisma. Unlike
// createAdmin, this catches a duplicate email rather than throwing — a
// very plausible mistake to make from this screen (typo, or the org
// already has that email), and there's no reason to 500 over it.
export async function platformCreateAdmin(formData: FormData) {
  await requirePlatformSuperadmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "SUPERADMIN" ? "SUPERADMIN" : "ADMIN";
  if (!organizationId || !email || password.length < 6) return;

  try {
    await prisma.admin.create({
      data: { email, passwordHash: hashPassword(password), role, organizationId },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }

  revalidateOrgPaths(organizationId);
}

// Lets a PLATFORM_SUPERADMIN log in as a box's own admin without knowing
// that admin's password — for support/QA, or to finish setting a box up
// after creating it. Prefers that box's oldest active SUPERADMIN (the
// "owner" account created alongside the box, see createOrganization) and
// falls back to its oldest active ADMIN if it has no SUPERADMIN left. The
// platform-superadmin's own session token is stashed in IMPERSONATOR_COOKIE
// rather than discarded, so stopImpersonating can restore it — admin_session
// itself is fully overwritten with the impersonated admin's real token
// (not a special "viewing as" mode), so every org-scoped action/page just
// works exactly as it would for that admin logging in themselves.
export async function impersonateOrganization(formData: FormData) {
  await requirePlatformSuperadmin();

  const organizationId = String(formData.get("organizationId") ?? "");
  if (!organizationId) return;

  const target =
    (await prisma.admin.findFirst({
      where: { organizationId, archived: false, role: "SUPERADMIN" },
      orderBy: { createdAt: "asc" },
    })) ??
    (await prisma.admin.findFirst({
      where: { organizationId, archived: false },
      orderBy: { createdAt: "asc" },
    }));
  if (!target) return; // no active admin to impersonate

  const jar = await cookies();
  const currentToken = jar.get(ADMIN_COOKIE)?.value;
  if (currentToken) jar.set(IMPERSONATOR_COOKIE, currentToken, SESSION_COOKIE_OPTIONS);

  jar.set(
    ADMIN_COOKIE,
    await createAdminSessionToken(target.id, target.role, target.organizationId),
    SESSION_COOKIE_OPTIONS
  );
  redirect("/admin");
}

// Restores the platform-superadmin session stashed by impersonateOrganization
// above. If that stash is missing, expired, or was somehow tampered with
// (or genuinely isn't a platform-superadmin token — it must be, since only
// impersonateOrganization ever writes it, but a corrupted/forged cookie
// should never silently grant platform access), send back to a real login
// rather than trust it.
export async function stopImpersonating() {
  const jar = await cookies();
  const impersonatorToken = jar.get(IMPERSONATOR_COOKIE)?.value;
  const session = await verifyAdminSessionToken(impersonatorToken);
  jar.delete(IMPERSONATOR_COOKIE);

  if (!session || session.organizationId !== null || session.role !== "PLATFORM_SUPERADMIN") {
    jar.delete(ADMIN_COOKIE);
    redirect("/admin-login");
  }

  jar.set(ADMIN_COOKIE, impersonatorToken!, SESSION_COOKIE_OPTIONS);
  redirect("/superadmin");
}
