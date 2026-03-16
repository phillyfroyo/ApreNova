-- AlterTable
ALTER TABLE "SessionLog" ADD COLUMN     "storySlug" TEXT;

-- CreateIndex
CREATE INDEX "SessionLog_userId_storySlug_idx" ON "SessionLog"("userId", "storySlug");
