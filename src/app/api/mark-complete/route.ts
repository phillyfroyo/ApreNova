import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { storySlug, level, chapter, page } = await req.json();

  if (!storySlug || !level || chapter === undefined || page === undefined) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  try {
    await prisma.completedStory.create({
      data: {
        userId: session.user.id,
        storySlug,
        level,
        chapter,
        page,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to log story completion:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
