-- AlterTable
ALTER TABLE "ClassInstance" ADD COLUMN "substituteCoachId" TEXT;

-- CreateIndex
CREATE INDEX "ClassInstance_substituteCoachId_idx" ON "ClassInstance"("substituteCoachId");
