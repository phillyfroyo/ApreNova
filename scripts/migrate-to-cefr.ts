// scripts/migrate-to-cefr.ts
// Migration script to convert l1-l6 level codes to CEFR (A1-C2)
// Run with: npx ts-node scripts/migrate-to-cefr.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Mapping from old level codes to CEFR
const LEVEL_TO_CEFR: Record<string, string> = {
  l1: "A1",
  l2: "A2",
  l3: "B1",
  l4: "B2",
  l5: "C1",
  l6: "C2",
  // Also handle numeric values that might be stored
  "1": "A1",
  "2": "A2",
  "3": "B1",
  "4": "B2",
  "5": "C1",
  "6": "C2",
};

function convertLevel(level: string | null | undefined): string | null {
  if (!level) return null;
  const lower = level.toLowerCase();
  return LEVEL_TO_CEFR[lower] || level; // Return as-is if already CEFR
}

async function migrateUsers() {
  console.log("Migrating User.quizLevel...");
  const users = await prisma.user.findMany({
    where: {
      quizLevel: { not: null },
    },
    select: { id: true, quizLevel: true },
  });

  let updated = 0;
  for (const user of users) {
    const newLevel = convertLevel(user.quizLevel);
    if (newLevel !== user.quizLevel) {
      await prisma.user.update({
        where: { id: user.id },
        data: { quizLevel: newLevel },
      });
      updated++;
    }
  }
  console.log(`  Updated ${updated}/${users.length} users`);
}

async function migrateCompletedStories() {
  console.log("Migrating CompletedStory.level...");
  const records = await prisma.completedStory.findMany({
    select: { id: true, level: true },
  });

  let updated = 0;
  for (const record of records) {
    const newLevel = convertLevel(record.level);
    if (newLevel && newLevel !== record.level) {
      await prisma.completedStory.update({
        where: { id: record.id },
        data: { level: newLevel },
      });
      updated++;
    }
  }
  console.log(`  Updated ${updated}/${records.length} completed stories`);
}

async function migrateStoryBookmarks() {
  console.log("Migrating StoryBookmark.level...");
  const records = await prisma.storyBookmark.findMany({
    select: { id: true, level: true },
  });

  let updated = 0;
  for (const record of records) {
    const newLevel = convertLevel(record.level);
    if (newLevel && newLevel !== record.level) {
      await prisma.storyBookmark.update({
        where: { id: record.id },
        data: { level: newLevel },
      });
      updated++;
    }
  }
  console.log(`  Updated ${updated}/${records.length} story bookmarks`);
}

async function migrateUserStories() {
  console.log("Migrating UserStory.detectedLevel...");
  const records = await prisma.userStory.findMany({
    where: {
      detectedLevel: { not: null },
    },
    select: { id: true, detectedLevel: true },
  });

  let updated = 0;
  for (const record of records) {
    const newLevel = convertLevel(record.detectedLevel);
    if (newLevel !== record.detectedLevel) {
      await prisma.userStory.update({
        where: { id: record.id },
        data: { detectedLevel: newLevel },
      });
      updated++;
    }
  }
  console.log(`  Updated ${updated}/${records.length} user stories`);
}

async function migrateUserStoryLevels() {
  console.log("Migrating UserStoryLevel.level...");
  const records = await prisma.userStoryLevel.findMany({
    select: { id: true, level: true },
  });

  let updated = 0;
  for (const record of records) {
    const newLevel = convertLevel(record.level);
    if (newLevel && newLevel !== record.level) {
      await prisma.userStoryLevel.update({
        where: { id: record.id },
        data: { level: newLevel },
      });
      updated++;
    }
  }
  console.log(`  Updated ${updated}/${records.length} user story levels`);
}

async function migrateUserStoryBookmarks() {
  console.log("Migrating UserStoryBookmark.level...");
  const records = await prisma.userStoryBookmark.findMany({
    select: { id: true, level: true },
  });

  let updated = 0;
  for (const record of records) {
    const newLevel = convertLevel(record.level);
    if (newLevel && newLevel !== record.level) {
      await prisma.userStoryBookmark.update({
        where: { id: record.id },
        data: { level: newLevel },
      });
      updated++;
    }
  }
  console.log(`  Updated ${updated}/${records.length} user story bookmarks`);
}

async function main() {
  console.log("===========================================");
  console.log("CEFR Migration: Converting l1-l6 to A1-C2");
  console.log("===========================================\n");

  try {
    await migrateUsers();
    await migrateCompletedStories();
    await migrateStoryBookmarks();
    await migrateUserStories();
    await migrateUserStoryLevels();
    await migrateUserStoryBookmarks();

    console.log("\n===========================================");
    console.log("Migration complete!");
    console.log("===========================================");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
