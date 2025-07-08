// src/app/api/user-stats/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  const totalTime = await prisma.sessionLog.aggregate({
    where: { userId },
    _sum: { ms: true },
  });

  const readingTime = await prisma.sessionLog.aggregate({
    where: { userId, type: 'reading' },
    _sum: { ms: true },
  });

  const completedCount = await prisma.completedStory.count({
    where: { userId },
  });

  return NextResponse.json({
    createdAt: user?.createdAt,
    totalMs: totalTime._sum.ms || 0,
    readingMs: readingTime._sum.ms || 0,
    storiesCompleted: completedCount,
  });
}
