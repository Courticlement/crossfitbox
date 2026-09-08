-- Adds Coach.calendarToken (the opaque secret embedded in a coach's
-- calendar subscription link — see /calendar/[organizationId]/[token] and
-- lib/actions/calendar-sync.ts).
--
-- Documentation only, like every migration since 20260904081635_multi_tenant_boxes:
-- tenant tables live in each organization's own "org_<id>" Postgres schema,
-- not "public" (see lib/prisma.ts), so this ALTER was actually applied per
-- existing org schema by a one-off script (mirroring lib/tenant-schema.ts's
-- tenantTableDdl, which is what provisions this column for every *new* org
-- going forward). Keep this file in sync with both.
ALTER TABLE "Coach" ADD COLUMN "calendarToken" TEXT;

CREATE UNIQUE INDEX "Coach_calendarToken_key" ON "Coach"("calendarToken");
