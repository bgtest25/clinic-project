-- CreateTable
CREATE TABLE "prior_auths" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "procedureOrMed" TEXT NOT NULL,
    "diagnosisCode" TEXT,
    "insurerName" TEXT,
    "clinicalRationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prior_auths_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prior_auths_noteId_idx" ON "prior_auths"("noteId");

-- AddForeignKey
ALTER TABLE "prior_auths" ADD CONSTRAINT "prior_auths_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "clinical_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
