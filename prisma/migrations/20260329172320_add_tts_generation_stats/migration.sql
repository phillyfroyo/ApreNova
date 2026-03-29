-- CreateTable
CREATE TABLE "TtsGenerationStat" (
    "id" TEXT NOT NULL,
    "storySlug" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "mode" TEXT NOT NULL,
    "speed" TEXT NOT NULL,
    "totalCharacters" INTEGER NOT NULL,
    "totalSentences" INTEGER NOT NULL,
    "generationDurationMs" INTEGER NOT NULL,
    "audioDurationMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TtsGenerationStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TtsGenerationStat_mode_speed_idx" ON "TtsGenerationStat"("mode", "speed");

-- CreateIndex
CREATE INDEX "TtsGenerationStat_createdAt_idx" ON "TtsGenerationStat"("createdAt");
