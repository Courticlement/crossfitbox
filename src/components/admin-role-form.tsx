"use client";

import { setAdminRole } from "@/lib/actions/admins";

export function AdminRoleForm({
  adminId,
  role,
  disabled = false,
}: {
  adminId: string;
  role: string;
  disabled?: boolean;
}) {
  return (
    <form action={setAdminRole} className="ml-auto">
      <input type="hidden" name="id" value={adminId} />
      <select
        name="role"
        defaultValue={role}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        disabled={disabled}
        className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-white disabled:opacity-40"
      >
        <option value="ADMIN">Admin</option>
        <option value="SUPERADMIN">Superadmin</option>
      </select>
    </form>
  );
}
