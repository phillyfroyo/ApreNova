// Script to clear story tutor conversation history for a specific story
import { prisma } from "./src/lib/prisma";

async function clearStoryHistory() {
  const storySlug = process.argv[2];
  const userEmail = process.argv[3];

  if (!storySlug || !userEmail) {
    console.log("Usage: npx tsx clear-story-history.ts <story-slug> <user-email>");
    console.log("Example: npx tsx clear-story-history.ts the-tree philip@example.com");
    process.exit(1);
  }

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: userEmail },
    });

    if (!user) {
      console.log(`❌ User not found with email: ${userEmail}`);
      process.exit(1);
    }

    // Count messages to delete
    const messageCount = await prisma.storyTutorMessage.count({
      where: {
        userId: user.id,
        storySlug,
      },
    });

    if (messageCount === 0) {
      console.log(`ℹ️  No messages found for story "${storySlug}" and user ${userEmail}`);
      process.exit(0);
    }

    // Delete all messages for this user and story
    const result = await prisma.storyTutorMessage.deleteMany({
      where: {
        userId: user.id,
        storySlug,
      },
    });

    console.log(`✅ Deleted ${result.count} messages for story "${storySlug}" and user ${userEmail}`);
  } catch (error) {
    console.error("❌ Error clearing story history:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

clearStoryHistory();
