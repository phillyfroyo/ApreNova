-- CreateEnum
CREATE TYPE "LevelStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "StoryVisibility" AS ENUM ('PRIVATE', 'SUBMITTED', 'PUBLIC', 'REJECTED');

-- CreateEnum
CREATE TYPE "UserStoryStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED', 'PARTIAL', 'CANCELLED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletedStory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storySlug" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chapter" INTEGER NOT NULL DEFAULT 1,
    "page" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CompletedStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ms" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryBookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storySlug" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "page" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoryBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageVisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storySlug" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "page" INTEGER NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryTutorMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "storySlug" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryTutorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedWord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "sourceSentence" TEXT,
    "storySlug" TEXT,
    "enrichedData" JSONB,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "translatedSentence" TEXT,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "nextReviewDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL,
    "savedWordId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "prevInterval" INTEGER NOT NULL,
    "prevEaseFactor" DOUBLE PRECISION NOT NULL,
    "newInterval" INTEGER NOT NULL,
    "newEaseFactor" DOUBLE PRECISION NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "password" TEXT,
    "nativeLanguage" TEXT,
    "quizLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "stripeCustomerId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UserStory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleEs" TEXT,
    "titleEn" TEXT,
    "description" TEXT,
    "descriptionEs" TEXT,
    "descriptionEn" TEXT,
    "sourceLanguage" TEXT NOT NULL,
    "detectedLevel" TEXT,
    "thumbnailUrl" TEXT,
    "storyType" TEXT,
    "targetAudience" TEXT,
    "tags" TEXT[],
    "hook" TEXT,
    "hookEs" TEXT,
    "hookEn" TEXT,
    "status" "UserStoryStatus" NOT NULL DEFAULT 'PROCESSING',
    "processingProgress" JSONB,
    "visibility" "StoryVisibility" NOT NULL DEFAULT 'PRIVATE',
    "processingMode" TEXT,
    "rawContent" TEXT NOT NULL,
    "rawHtml" TEXT,
    "sourceFormat" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStoryBookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userStoryId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "chapter" INTEGER NOT NULL,
    "page" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStoryBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStoryLevel" (
    "id" TEXT NOT NULL,
    "userStoryId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "status" "LevelStatus" NOT NULL DEFAULT 'PENDING',
    "processingProgress" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStoryLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCost" (
    "id" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL,
    "userId" TEXT,
    "userStoryId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletedUserStory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalStoryId" TEXT NOT NULL,
    "costCents" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedUserStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlgorithmTestFile" (
    "id" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "storyType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rawContent" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlgorithmTestFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlgorithmTestResult" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "processingTimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlgorithmTestResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "CompletedStory_userId_storySlug_level_chapter_page_key" ON "CompletedStory"("userId", "storySlug", "level", "chapter", "page");

-- CreateIndex
CREATE INDEX "OtpCode_createdAt_idx" ON "OtpCode"("createdAt");

-- CreateIndex
CREATE INDEX "OtpCode_email_expiresAt_idx" ON "OtpCode"("email", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "StoryBookmark_userId_idx" ON "StoryBookmark"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryBookmark_userId_storySlug_key" ON "StoryBookmark"("userId", "storySlug");

-- CreateIndex
CREATE INDEX "PageVisit_userId_idx" ON "PageVisit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PageVisit_userId_storySlug_level_chapter_page_key" ON "PageVisit"("userId", "storySlug", "level", "chapter", "page");

-- CreateIndex
CREATE INDEX "StoryTutorMessage_userId_storySlug_createdAt_idx" ON "StoryTutorMessage"("userId", "storySlug", "createdAt");

-- CreateIndex
CREATE INDEX "TutorMessage_userId_createdAt_idx" ON "TutorMessage"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedWord_userId_nextReviewDate_idx" ON "SavedWord"("userId", "nextReviewDate");

-- CreateIndex
CREATE INDEX "SavedWord_userId_idx" ON "SavedWord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedWord_userId_word_sourceSentence_key" ON "SavedWord"("userId", "word", "sourceSentence");

-- CreateIndex
CREATE INDEX "ReviewLog_userId_reviewedAt_idx" ON "ReviewLog"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "ReviewLog_savedWordId_idx" ON "ReviewLog"("savedWordId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "UserStory_userId_status_idx" ON "UserStory"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserStory_userId_slug_key" ON "UserStory"("userId", "slug");

-- CreateIndex
CREATE INDEX "UserStoryBookmark_userId_idx" ON "UserStoryBookmark"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStoryBookmark_userId_userStoryId_key" ON "UserStoryBookmark"("userId", "userStoryId");

-- CreateIndex
CREATE INDEX "UserStoryLevel_userStoryId_idx" ON "UserStoryLevel"("userStoryId");

-- CreateIndex
CREATE UNIQUE INDEX "UserStoryLevel_userStoryId_level_key" ON "UserStoryLevel"("userStoryId", "level");

-- CreateIndex
CREATE INDEX "ApiCost_userId_idx" ON "ApiCost"("userId");

-- CreateIndex
CREATE INDEX "ApiCost_userStoryId_idx" ON "ApiCost"("userStoryId");

-- CreateIndex
CREATE INDEX "ApiCost_operation_idx" ON "ApiCost"("operation");

-- CreateIndex
CREATE INDEX "ApiCost_createdAt_idx" ON "ApiCost"("createdAt");

-- CreateIndex
CREATE INDEX "ApiCost_provider_model_idx" ON "ApiCost"("provider", "model");

-- CreateIndex
CREATE INDEX "DeletedUserStory_userId_idx" ON "DeletedUserStory"("userId");

-- CreateIndex
CREATE INDEX "AlgorithmTestFile_fileType_storyType_idx" ON "AlgorithmTestFile"("fileType", "storyType");

-- CreateIndex
CREATE UNIQUE INDEX "AlgorithmTestFile_fileType_storyType_fileName_key" ON "AlgorithmTestFile"("fileType", "storyType", "fileName");

-- CreateIndex
CREATE INDEX "AlgorithmTestResult_fileId_createdAt_idx" ON "AlgorithmTestResult"("fileId", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletedStory" ADD CONSTRAINT "CompletedStory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryBookmark" ADD CONSTRAINT "StoryBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageVisit" ADD CONSTRAINT "PageVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryTutorMessage" ADD CONSTRAINT "StoryTutorMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorMessage" ADD CONSTRAINT "TutorMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedWord" ADD CONSTRAINT "SavedWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_savedWordId_fkey" FOREIGN KEY ("savedWordId") REFERENCES "SavedWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStory" ADD CONSTRAINT "UserStory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStoryBookmark" ADD CONSTRAINT "UserStoryBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStoryBookmark" ADD CONSTRAINT "UserStoryBookmark_userStoryId_fkey" FOREIGN KEY ("userStoryId") REFERENCES "UserStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStoryLevel" ADD CONSTRAINT "UserStoryLevel_userStoryId_fkey" FOREIGN KEY ("userStoryId") REFERENCES "UserStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCost" ADD CONSTRAINT "ApiCost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCost" ADD CONSTRAINT "ApiCost_userStoryId_fkey" FOREIGN KEY ("userStoryId") REFERENCES "UserStory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletedUserStory" ADD CONSTRAINT "DeletedUserStory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlgorithmTestResult" ADD CONSTRAINT "AlgorithmTestResult_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "AlgorithmTestFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

