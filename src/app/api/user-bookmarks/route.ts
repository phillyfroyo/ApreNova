// src/app/api/user-bookmarks/route.ts
// Get user's recent story bookmarks for "Continue Reading" feature

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's most recent bookmarks (up to 5)
    const bookmarks = await prisma.storyBookmark.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 5,
    });

    return NextResponse.json({ bookmarks });
  } catch (error) {
    console.error('Error fetching user bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bookmarks' },
      { status: 500 }
    );
  }
}
