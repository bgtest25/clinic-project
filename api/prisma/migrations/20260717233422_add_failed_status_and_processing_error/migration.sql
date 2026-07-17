-- AlterEnum
ALTER TYPE "EncounterStatus" ADD VALUE 'FAILED';

-- AlterTable
ALTER TABLE "encounters" ADD COLUMN     "processingError" TEXT;
