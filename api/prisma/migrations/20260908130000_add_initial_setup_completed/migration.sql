-- Add initial setup completion tracking for smart invite/reset labeling
ALTER TABLE "users" ADD COLUMN "initialSetupCompletedAt" TIMESTAMP(3);
