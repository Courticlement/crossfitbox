-- Adds Coach.isGuest — an outside coach named by the admin from the
-- Planning grid to cover a class (see assignGuestCoach).
--
-- Documentation only, like every migration since 20260904081635_multi_tenant_boxes:
-- applied per existing org schema by a one-off script (see lib/tenant-schema.ts's
-- tenantTableDdl for new orgs). Keep this file in sync with both.

ALTER TABLE "Coach" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false;
