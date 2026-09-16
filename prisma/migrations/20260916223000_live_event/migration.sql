-- CreateTable
CREATE TABLE "LiveEvent" (
    "id" SERIAL NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveEvent_targetEmail_id_idx" ON "LiveEvent"("targetEmail", "id");
