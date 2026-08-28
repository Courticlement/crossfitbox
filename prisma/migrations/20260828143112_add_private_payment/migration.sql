-- CreateTable
CREATE TABLE "PrivatePayment" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivatePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrivatePayment_coachId_idx" ON "PrivatePayment"("coachId");

-- CreateIndex
CREATE INDEX "PrivatePayment_paidAt_idx" ON "PrivatePayment"("paidAt");

-- AddForeignKey
ALTER TABLE "PrivatePayment" ADD CONSTRAINT "PrivatePayment_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;
