-- AlterTable
ALTER TABLE "Coach" ADD COLUMN "level" TEXT;

-- AlterTable
ALTER TABLE "ClassTemplate" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ClassInstance" ADD COLUMN "isPrivate" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClassInstance" ADD COLUMN "attendeeCount" INTEGER;
