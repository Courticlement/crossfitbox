-- CreateTable
CREATE TABLE "PlanningWeek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekStart" DATETIME NOT NULL,
    "validatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanningWeek_weekStart_key" ON "PlanningWeek"("weekStart");
