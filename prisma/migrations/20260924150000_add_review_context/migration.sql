-- Adds ClassReview.reviewContext — "class" (a real class, athletes
-- present) or "observation" (training/shadowing session, no athletes) —
-- picked first in the review wizard, before any notes, purely to give the
-- rest of the review context.
--
-- Documentation only, like every migration since 20260904081635_multi_tenant_boxes:
-- tenant tables live in each organization's own "org_<id>" Postgres schema,
-- not "public" (see lib/prisma.ts), so this was actually applied per
-- existing org schema by a one-off script (mirroring lib/tenant-schema.ts's
-- tenantTableDdl, which is what provisions this column for every *new* org
-- going forward). Keep this file in sync with both.

ALTER TABLE "ClassReview" ADD COLUMN "reviewContext" TEXT NOT NULL DEFAULT 'class';
