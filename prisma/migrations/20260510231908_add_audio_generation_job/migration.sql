-- CreateTable
CREATE TABLE "AudioGenerationJob" (
    "id" TEXT NOT NULL,
    "storySlug" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "speed" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalSentences" INTEGER,
    "sentencesComplete" INTEGER,
    "totalChunks" INTEGER,
    "chunksComplete" INTEGER,
    "currentStep" TEXT,
    "audioUrl" TEXT,
    "errorMessage" TEXT,
    "chunkData" JSONB,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AudioGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AudioGenerationJob_storySlug_level_chapter_mode_speed_statu_idx" ON "AudioGenerationJob"("storySlug", "level", "chapter", "mode", "speed", "status");

-- CreateIndex
CREATE INDEX "AudioGenerationJob_userId_createdAt_idx" ON "AudioGenerationJob"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AudioGenerationJob" ADD CONSTRAINT "AudioGenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
