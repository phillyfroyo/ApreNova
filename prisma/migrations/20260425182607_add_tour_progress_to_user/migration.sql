-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tourCompletedAt" TIMESTAMP(3),
ADD COLUMN     "tourStep1CompletedAt" TIMESTAMP(3),
ADD COLUMN     "tourStep2CompletedAt" TIMESTAMP(3),
ADD COLUMN     "tourStep3CompletedAt" TIMESTAMP(3);
