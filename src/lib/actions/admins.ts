"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/auth-context";

// Every action here is SUPERADMIN-only, and scoped to the caller's own
// Organization — proxy.ts already keeps a plain ADMIN off the
// /admin/admins page, but server actions are reachable directly regardless
// of which page rendered the form, so each one re-checks for itself.
async function requireSuperadmin(): Promise<{ adminId: string; organizationId: string }> {
  const session = await requireAdmin();
  if (!session || !session.organizationId || session.role !== "SUPERADMIN") {
    throw new Error("Forbidden");
  }
  return { adminId: session.adminId, organizationId: session.organizationId };
}

function revalidateAdminsPath() {
  revalidatePath("/admin/admins");
}

export async function createAdmin(formData: FormData) {
  const { organizationId } = await requireSuperadmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "SUPERADMIN" ? "SUPERADMIN" : "ADMIN";
  if (!email || password.length < 6) return;

  await prisma.admin.create({
    data: { email, passwordHash: hashPassword(password), role, organizationId },
  });
  revalidateAdminsPath();
}

// Sets (or resets) an admin's login password. Same shape as
// setCoachPassword in lib/actions/coaches.ts.
export async function setAdminPassword(formData: FormData) {
  const { organizationId } = await requireSuperadmin();

  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!id || password.length < 6) return;

  await prisma.admin.updateMany({
    where: { id, organizationId },
    data: { passwordHash: hashPassword(password) },
  });
  revalidateAdminsPath();
}

export async function setAdminRole(formData: FormData) {
  const { adminId: actingId, organizationId } = await requireSuperadmin();

  const id = String(formData.get("id") ?? "");
  const role = formData.get("role") === "SUPERADMIN" ? "SUPERADMIN" : "ADMIN";
  if (!id) return;
  // A superadmin demoting themselves (with no one else to promote first)
  // would lock everyone out of /admin/admins for this box — block it
  // rather than trust the UI alone, since this action is reachable
  // directly. Scoped to this box: another box's superadmin count must
  // never affect whether this box can demote its own last one.
  if (id === actingId && role !== "SUPERADMIN") {
    const otherSuperadmins = await prisma.admin.count({
      where: { role: "SUPERADMIN", archived: false, organizationId, id: { not: actingId } },
    });
    if (otherSuperadmins === 0) return;
  }

  await prisma.admin.updateMany({ where: { id, organizationId }, data: { role } });
  revalidateAdminsPath();
}

// Soft-delete, mirroring archiveCoach/unarchiveCoach: revokes login without
// losing the account.
export async function archiveAdmin(formData: FormData) {
  const { adminId: actingId, organizationId } = await requireSuperadmin();

  const id = String(formData.get("id") ?? "");
  if (!id || id === actingId) return; // never let a superadmin lock themselves out

  await prisma.admin.updateMany({ where: { id, organizationId }, data: { archived: true } });
  revalidateAdminsPath();
}

export async function unarchiveAdmin(formData: FormData) {
  const { organizationId } = await requireSuperadmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.admin.updateMany({ where: { id, organizationId }, data: { archived: false } });
  revalidateAdminsPath();
}
