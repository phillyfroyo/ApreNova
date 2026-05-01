// Reset the discovery tour state for a user, so the tour fires again from step 1.
// Usage: node scripts/reset-tour.mjs <email>
// Add --dry to preview without writing.

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.argv[2];
const dry = process.argv.includes('--dry');

if (!email) {
  console.error('Usage: node scripts/reset-tour.mjs <email> [--dry]');
  process.exit(1);
}

const user = await prisma.user.findUnique({
  where: { email },
  select: {
    id: true,
    email: true,
    name: true,
    tourStep1CompletedAt: true,
    tourStep2CompletedAt: true,
    tourStep3CompletedAt: true,
    tourCompletedAt: true,
  },
});

if (!user) {
  console.error(`No user found with email: ${email}`);
  process.exit(1);
}

console.log('Found user:');
console.log(user);

if (dry) {
  console.log('\n--dry: not resetting');
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.user.update({
  where: { id: user.id },
  data: {
    tourStep1CompletedAt: null,
    tourStep2CompletedAt: null,
    tourStep3CompletedAt: null,
    tourCompletedAt: null,
  },
});

console.log(`\nTour reset for ${email}. Sign in (or refresh if signed in) and visit a story page.`);
await prisma.$disconnect();
