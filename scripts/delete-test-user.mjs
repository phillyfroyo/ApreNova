// One-off script to hard-delete a test user.
// Usage: node scripts/delete-test-user.mjs <email>
// Run with --dry to preview without deleting.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.argv[2];
const dry = process.argv.includes('--dry');

if (!email) {
  console.error('Usage: node scripts/delete-test-user.mjs <email> [--dry]');
  process.exit(1);
}

const user = await prisma.user.findUnique({
  where: { email },
  include: {
    _count: {
      select: {
        Account: true,
        Session: true,
        SessionLog: true,
        PageVisit: true,
        CompletedStory: true,
        StoryBookmark: true,
        UserStoryBookmark: true,
        StoryTutorMessage: true,
        TutorMessage: true,
        ReviewLog: true,
        SavedWord: true,
        UserStory: true,
        ApiCost: true,
        DeletedUserStory: true,
      },
    },
  },
});

if (!user) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

console.log('Found user:');
console.log({
  id: user.id,
  email: user.email,
  name: user.name,
  phone: user.phone,
  createdAt: user.createdAt,
  related: user._count,
});

if (dry) {
  console.log('\n--dry: not deleting');
  await prisma.$disconnect();
  process.exit(0);
}

const userId = user.id;

await prisma.$transaction([
  prisma.sessionLog.deleteMany({ where: { userId } }),
  prisma.pageVisit.deleteMany({ where: { userId } }),
  prisma.completedStory.deleteMany({ where: { userId } }),
  prisma.storyBookmark.deleteMany({ where: { userId } }),
  prisma.userStoryBookmark.deleteMany({ where: { userId } }),
  prisma.storyTutorMessage.deleteMany({ where: { userId } }),
  prisma.tutorMessage.deleteMany({ where: { userId } }),
  prisma.reviewLog.deleteMany({ where: { userId } }),
  prisma.savedWord.deleteMany({ where: { userId } }),
  prisma.account.deleteMany({ where: { userId } }),
  prisma.session.deleteMany({ where: { userId } }),
  prisma.deletedUserStory.deleteMany({ where: { userId } }),
  prisma.apiCost.deleteMany({ where: { userId } }),
  prisma.userStory.deleteMany({ where: { userId } }),
  prisma.user.delete({ where: { id: userId } }),
]);

console.log(`\nHard-deleted user ${userId}`);
await prisma.$disconnect();
