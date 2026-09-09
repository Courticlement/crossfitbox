-- Adds ClassInstance.athleteName and ClassInstance.athleteIsMember — the
-- athlete's name and whether they're a subscribed box member, captured on
-- the coach's "Cours privés" form (addPrivateClass in
-- lib/actions/submissions.ts) when logging a private class. Both are null
-- for a group class or team event.
--
-- Documentation only, like every migration since 20260904081635_multi_tenant_boxes:
-- tenant tables live in each organization's own "org_<id>" Postgres schema,
-- not "public" (see lib/prisma.ts), so this ALTER was actually applied per
-- existing org schema by a one-off script (mirroring lib/tenant-schema.ts's
-- tenantTableDdl, which is what provisions these columns for every *new* org
-- going forward). Keep this file in sync with both.
ALTER TABLE "ClassInstance" ADD COLUMN "athleteName" TEXT;
ALTER TABLE "ClassInstance" ADD COLUMN "athleteIsMember" BOOLEAN;
