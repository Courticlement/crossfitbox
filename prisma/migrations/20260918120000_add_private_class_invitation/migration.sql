-- Adds PrivateClassInvitation — the admin's nudge inviting a specific
-- coach to log a private class on their own My Classes page. Shown as a
-- dismissible banner on /upload; never creates a ClassInstance itself.
--
-- Documentation only, like every migration since 20260904081635_multi_tenant_boxes:
-- tenant tables live in each organization's own "org_<id>" Postgres schema,
-- not "public" (see lib/prisma.ts), so this table was actually created per
-- existing org schema by a one-off script (mirroring lib/tenant-schema.ts's
-- tenantTableDdl, which is what provisions it for every *new* org going
-- forward). Keep this file in sync with both.
CREATE TABLE "PrivateClassInvitation" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "PrivateClassInvitation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PrivateClassInvitation_coachId_idx" ON "PrivateClassInvitation"("coachId");

ALTER TABLE "PrivateClassInvitation" ADD CONSTRAINT "PrivateClassInvitation_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
