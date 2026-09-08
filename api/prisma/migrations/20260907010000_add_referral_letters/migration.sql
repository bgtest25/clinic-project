-- CreateTable
CREATE TABLE "referral_letters" (
    "id" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "letterContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referral_letters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "referral_letters_noteId_idx" ON "referral_letters"("noteId");

-- AddForeignKey
ALTER TABLE "referral_letters" ADD CONSTRAINT "referral_letters_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "clinical_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
