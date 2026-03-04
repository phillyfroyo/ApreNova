// src/app/api/saved-words/stats/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

// GET: Retrieve vocabulary statistics for the user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const now = new Date();

    // Get all stats in parallel
    const [
      totalSaved,
      dueToday,
      masteredCount,
      learningCount,
      reviewsToday,
    ] = await Promise.all([
      // Total saved words
      prisma.savedWord.count({
        where: { userId },
      }),

      // Words due for review (nextReviewDate <= now)
      prisma.savedWord.count({
        where: {
          userId,
          nextReviewDate: { lte: now },
        },
      }),

      // Mastered words (interval >= 21 days, meaning well-learned)
      prisma.savedWord.count({
        where: {
          userId,
          interval: { gte: 21 },
        },
      }),

      // Learning words (has been reviewed at least once but not mastered)
      prisma.savedWord.count({
        where: {
          userId,
          repetitions: { gte: 1 },
          interval: { lt: 21 },
        },
      }),

      // Reviews completed today
      prisma.reviewLog.count({
        where: {
          userId,
          reviewedAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
      }),
    ]);

    // New words = total - learning - mastered
    const newCount = totalSaved - learningCount - masteredCount;

    return NextResponse.json({
      totalSaved,
      dueToday,
      newCount,
      learningCount,
      masteredCount,
      reviewsToday,
    });
  } catch (error: any) {
    console.error('Error retrieving vocabulary stats:', error?.message || error);
    return NextResponse.json(
      { error: 'Failed to retrieve stats', details: error?.message },
      { status: 500 }
    );
  }
}
