"use server";

import { revalidatePath } from "next/cache";
import { tenantPrisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireOrgAdmin } from "@/lib/auth-context";

function revalidateRoomsPaths() {
  revalidatePath("/admin/rooms");
  revalidatePath("/admin/templates");
  revalidatePath("/admin/planning");
}

export async function createRoom(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const name = String(formData.get("name") ?? "").trim();
  const shortLabel = String(formData.get("shortLabel") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!name) return;

  try {
    await prisma.room.create({ data: { organizationId, name, shortLabel, color } });
  } catch (err) {
    // Room name already taken in this organization — silent no-op, same
    // convention as createCoach's upsert-on-collision.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
  revalidateRoomsPaths();
}

// No hard-delete: a room may be referenced by historical
// ClassTemplate/ClassInstance rows (roomId is required, onDelete:
// Restrict), so it's archived instead, mirroring Coach's archive pattern.
export async function renameRoom(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const shortLabel = String(formData.get("shortLabel") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!id || !name) return;

  try {
    await prisma.room.updateMany({
      where: { id },
      data: { name, shortLabel, color },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
  revalidateRoomsPaths();
}

export async function archiveRoom(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.room.updateMany({ where: { id }, data: { archived: true } });
  revalidateRoomsPaths();
}

export async function unarchiveRoom(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const prisma = tenantPrisma(organizationId);

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await prisma.room.updateMany({ where: { id }, data: { archived: false } });
  revalidateRoomsPaths();
}
