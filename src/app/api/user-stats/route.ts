// src/app/api/user-stats/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

// Calculate current streak (consecutive days with app activity)
async function calculateStreak(userId: string): Promise<number> {
  // Get all unique dates with session logs, ordered descending
  const sessionLogs = await prisma.sessionLog.findMany({
    where: { userId },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  if (sessionLogs.length === 0) return 0;

  // Get unique dates (in user's local date format)
  const uniqueDates = [...new Set(
    sessionLogs.map(log => log.createdAt.toISOString().split('T')[0])
  )].sort((a, b) => b.localeCompare(a)); // Most recent first

  if (uniqueDates.length === 0) return 0;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Check if streak is still active (activity today or yesterday)
  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) {
    return 0; // Streak broken
  }

  // Count consecutive days
  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prevDate = new Date(uniqueDates[i - 1]);
    const currDate = new Date(uniqueDates[i]);
    const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / 86400000);

    if (diffDays === 1) {
      streak++;
    } else {
      break; // Gap in dates, streak ends
    }
  }

  return streak;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  // Run queries in parallel for performance
  const [user, totalTime, readingTime, completedCount, wordsRead, pagesRead, streak] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    }),
    prisma.sessionLog.aggregate({
      where: { userId },
      _sum: { ms: true },
    }),
    prisma.sessionLog.aggregate({
      where: { userId, type: 'reading' },
      _sum: { ms: true },
    }),
    prisma.completedStory.count({
      where: { userId },
    }),
    prisma.pageVisit.aggregate({
      where: { userId },
      _sum: { wordCount: true },
    }),
    prisma.pageVisit.count({
      where: { userId },
    }),
    calculateStreak(userId),
  ]);

  // User number = count of users created on or before this user
  const userNumber = user?.createdAt
    ? await prisma.user.count({
        where: { createdAt: { lte: user.createdAt } },
      })
    : null;

  // Count unique chapters visited
  const uniqueChapters = await prisma.pageVisit.groupBy({
    by: ['storySlug', 'level', 'chapter'],
    where: { userId },
  });

  return NextResponse.json({
    createdAt: user?.createdAt,
    totalMs: totalTime._sum.ms || 0,
    readingMs: readingTime._sum.ms || 0,
    storiesCompleted: completedCount,
    wordsRead: wordsRead._sum.wordCount || 0,
    pagesRead: pagesRead,
    chaptersVisited: uniqueChapters.length,
    currentStreak: streak,
    userNumber,
  });
}
