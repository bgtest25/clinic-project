-- CreateEnum
CREATE TYPE "ClinicStatus" AS ENUM ('PENDING_BAA', 'PENDING_SETUP', 'ACTIVE', 'SUSPENDED');

-- AlterEnum (add new roles)
ALTER TYPE "UserRole" ADD VALUE 'OWNER';
ALTER TYPE "UserRole" ADD VALUE 'STAFF';

-- AlterTable: Add new fields to clinics
ALTER TABLE "clinics" ADD COLUMN "status" "ClinicStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "clinics" ADD COLUMN "addressStreet" TEXT;
ALTER TABLE "clinics" ADD COLUMN "addressCity" TEXT;
ALTER TABLE "clinics" ADD COLUMN "addressState" TEXT;
ALTER TABLE "clinics" ADD COLUMN "addressZip" TEXT;
ALTER TABLE "clinics" ADD COLUMN "phone" TEXT;
ALTER TABLE "clinics" ADD COLUMN "fax" TEXT;
ALTER TABLE "clinics" ADD COLUMN "email" TEXT;
ALTER TABLE "clinics" ADD COLUMN "npi" TEXT;
ALTER TABLE "clinics" ADD COLUMN "taxId" TEXT;
ALTER TABLE "clinics" ADD COLUMN "logoUrl" TEXT;
ALTER TABLE "clinics" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/New_York';

-- AlterTable: Add new fields to users
ALTER TABLE "users" ADD COLUMN "credentials" TEXT;
ALTER TABLE "users" ADD COLUMN "title" TEXT;
ALTER TABLE "users" ADD COLUMN "specialty" TEXT;
ALTER TABLE "users" ADD COLUMN "individualNpi" TEXT;
ALTER TABLE "users" ADD COLUMN "licenseNumber" TEXT;
ALTER TABLE "users" ADD COLUMN "licenseState" TEXT;
ALTER TABLE "users" ADD COLUMN "signatureImageUrl" TEXT;
ALTER TABLE "users" ADD COLUMN "signatureType" TEXT;
ALTER TABLE "users" ADD COLUMN "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "hipaaTrainingCompletedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "confidentialitySignedAt" TIMESTAMP(3);

-- CreateTable: locations
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "addressStreet" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressZip" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "npi" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: baa_signatures
CREATE TABLE "baa_signatures" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "signatoryName" TEXT NOT NULL,
    "signatoryTitle" TEXT NOT NULL,
    "signatoryEmail" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "signedByUserId" TEXT,
    "baaVersion" TEXT NOT NULL,
    "documentS3Key" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baa_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable: hipaa_training
CREATE TABLE "hipaa_training" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trainingType" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attestationText" TEXT NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hipaa_training_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "locations_clinicId_idx" ON "locations"("clinicId");

-- CreateIndex
CREATE INDEX "baa_signatures_clinicId_idx" ON "baa_signatures"("clinicId");

-- CreateIndex
CREATE INDEX "hipaa_training_userId_idx" ON "hipaa_training"("userId");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baa_signatures" ADD CONSTRAINT "baa_signatures_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baa_signatures" ADD CONSTRAINT "baa_signatures_signedByUserId_fkey" FOREIGN KEY ("signedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hipaa_training" ADD CONSTRAINT "hipaa_training_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
